import os
import json
import uuid
import base64
import logging
import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

# Load .env manually if needed or use dotenv
from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="CartMate AI Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load catalogue
try:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(BASE_DIR, "catalogue.json"), "r") as f:
        PRODUCT_CATALOGUE = json.load(f)
except Exception as e:
    logger.error(f"Failed to load catalogue: {e}")
    PRODUCT_CATALOGUE = []

# In-memory session store
# { session_id: { "history": [ {"role": "user", "parts": [{"text": "..."}]}, ... ] } }
SESSIONS = {}

AIMLAPI_KEY = os.getenv("AIMLAPI_KEY", "")
SPEECHMATICS_API_KEY = os.getenv("SPEECHMATICS_API_KEY", "")
SERPAPI_KEY = os.getenv("SERPAPI_KEY", "")

SYSTEM_INSTRUCTION = """
You are CartMate, an AI shopping assistant. You help users discover products by asking clarifying questions and making recommendations.
Be conversational, concise, and helpful. Ask ONE clarifying question per turn if you need more info (e.g. category, budget, color).
If you have enough information, use the search_products tool to find and recommend 2 to 5 real products.
Do not answer off-topic queries, redirect them politely to shopping.
Do NOT output any JSON blocks or <recommendations> tags in your response. Just provide a natural, user-friendly text response describing the products.
"""

async def search_catalogue(query: str, filters: dict = None) -> List[dict]:
    if not SERPAPI_KEY:
        logger.warning("SERPAPI_KEY not set. Falling back to local catalogue.")
        results = []
        q = query.lower()
        for prod in PRODUCT_CATALOGUE:
            if q in prod['name'].lower() or q in prod['description'].lower() or any(q in t for t in prod['tags']):
                results.append(prod)
        return results[:5]

    url = "https://serpapi.com/search.json"
    params = {
        "engine": "google_shopping",
        "q": query,
        "api_key": SERPAPI_KEY
    }
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, params=params, timeout=10.0)
            data = resp.json()
            shopping_results = data.get("shopping_results", [])
            
            results = []
            for item in shopping_results[:5]:
                results.append({
                    "id": item.get("product_id", str(uuid.uuid4())[:8]),
                    "name": item.get("title", "Real Product"),
                    "price": item.get("extracted_price", 0.0),
                    "currency": "USD",
                    "description": f"Available from {item.get('source', 'Online retailer')}.",
                    "image_url": item.get("thumbnail", "https://placehold.co/400x400"),
                    "stock_status": "In Stock",
                    "product_link": item.get("link", "")
                })
            return results
        except Exception as e:
            logger.error(f"SerpApi error: {e}")
            results = []
            q = query.lower()
            for prod in PRODUCT_CATALOGUE:
                if q in prod['name'].lower() or q in prod['description'].lower() or any(q in t for t in prod['tags']):
                    results.append(prod)
            return results[:5]

@app.post("/api/session")
async def create_session():
    session_id = str(uuid.uuid4())
    SESSIONS[session_id] = {"history": []}
    return {"session_id": session_id}

class ChatRequest(BaseModel):
    session_id: str
    message: Optional[str] = ""
    image_base64: Optional[str] = None

@app.post("/api/chat")
async def chat(req: ChatRequest):
    if req.session_id not in SESSIONS:
        SESSIONS[req.session_id] = {"history": []}
    
    session = SESSIONS[req.session_id]
    
    user_content = []
    if req.message:
        user_content.append({"type": "text", "text": req.message})
    
    if req.image_base64:
        try:
            mime_type, base64_data = req.image_base64.split(",", 1)
            mime_type = mime_type.split(":")[1].split(";")[0]
            user_content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:{mime_type};base64,{base64_data}"
                }
            })
            if not req.message:
                user_content.append({"type": "text", "text": "Extract visual attributes from this image: category, color, material, style. Then recommend similar items."})
        except Exception as e:
            logger.error(f"Image parse error: {e}")
            
    if not user_content:
        raise HTTPException(status_code=400, detail="No input provided")

    session["history"].append({"role": "user", "content": user_content})
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {AIMLAPI_KEY}"
    }
    
    # Setup tools for OpenAI format
    tools = [
        {
            "type": "function",
            "function": {
                "name": "search_products",
                "description": "Search the product catalogue to find recommendations for the user. Returns a list of products.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Search query based on user preferences"
                        }
                    },
                    "required": ["query"]
                }
            }
        }
    ]

    messages = [{"role": "system", "content": SYSTEM_INSTRUCTION}] + session["history"]

    payload = {
        "model": "google/gemini-3-flash-preview",
        "messages": messages,
        "tools": tools,
        "temperature": 0.4
    }
    
    aiml_url = "https://api.aimlapi.com/v1/chat/completions"
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(aiml_url, headers=headers, json=payload, timeout=20.0)
            data = resp.json()
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
            
        if "error" in data:
            raise HTTPException(status_code=500, detail=data["error"]["message"])
            
        choice = data["choices"][0]
        message = choice["message"]
        
        # Check if function call
        if message.get("tool_calls"):
            tool_call = message["tool_calls"][0]
            if tool_call["function"]["name"] == "search_products":
                import json as json_lib
                try:
                    args = json_lib.loads(tool_call["function"]["arguments"])
                except Exception:
                    args = {"query": req.message or "products"}
                q = args.get("query", "")
                results = await search_catalogue(q)
                
                # Provide tool response back
                # Since AIMLAPI is OpenAI compatible, we append assistant and tool roles
                session["history"].append(message)
                session["history"].append({
                    "role": "tool",
                    "tool_call_id": tool_call["id"],
                    "name": "search_products",
                    "content": json_lib.dumps({"products": results})
                })
                
                messages = [{"role": "system", "content": SYSTEM_INSTRUCTION}] + session["history"]
                payload["messages"] = messages
                
                resp2 = await client.post(aiml_url, headers=headers, json=payload, timeout=15.0)
                data2 = resp2.json()
                
                if "error" in data2:
                    raise HTTPException(status_code=500, detail=data2["error"]["message"])
                    
                final_text = data2["choices"][0]["message"].get("content", "")
                session["history"].append(data2["choices"][0]["message"])
                
                # Clean up any residual JSON tags the model might mistakenly output
                import re
                final_text = re.sub(r'<recommendations>.*?</recommendations>', '', final_text, flags=re.DOTALL).strip()
                final_text = re.sub(r'```json\n.*?```', '', final_text, flags=re.DOTALL).strip()
                
                return {"text": final_text, "products": results}
        else:
            final_text = message.get("content", "")
            session["history"].append(message)
            
            import re
            final_text = re.sub(r'<recommendations>.*?</recommendations>', '', final_text, flags=re.DOTALL).strip()
            final_text = re.sub(r'```json\n.*?```', '', final_text, flags=re.DOTALL).strip()
            
            return {"text": final_text, "products": []}



class ImageRequest(BaseModel):
    session_id: str
    image_base64: str  # Data URI format: data:image/jpeg;base64,...

@app.post("/api/visual-match")
async def visual_match(req: ImageRequest):
    if req.session_id not in SESSIONS:
        SESSIONS[req.session_id] = {"history": []}
        
    try:
        mime_type, base64_data = req.image_base64.split(",", 1)
        mime_type = mime_type.split(":")[1].split(";")[0]
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image format")
        
    prompt = "Extract visual attributes from this image: category, color, material, style. Return ONLY a JSON object with these keys."
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {AIMLAPI_KEY}"
    }

    payload = {
        "model": "google/gemini-3-flash-preview",
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{base64_data}"
                        }
                    }
                ]
            }
        ],
        "temperature": 0.4
    }
    
    aiml_url = "https://api.aimlapi.com/v1/chat/completions"
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(aiml_url, headers=headers, json=payload, timeout=20.0)
            data = resp.json()
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
        
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"]["message"])
        
    text_resp = data["choices"][0]["message"].get("content", "")
    
    # Try to parse JSON from response
    try:
        import re
        json_str = re.search(r'\{.*\}', text_resp, re.DOTALL).group()
        attrs = json.loads(json_str)
        
        # Search catalog with attributes
        query = " ".join([str(v) for v in attrs.values()])
        results = await search_catalogue(query)
        
        SESSIONS[req.session_id]["history"].append({
            "role": "user",
            "content": f"I shared an image with these attributes: {query}. What do you think?"
        })
        SESSIONS[req.session_id]["history"].append({
            "role": "assistant",
            "content": f"Based on the image, I found some visually similar products."
        })
        
        return {
            "attributes": attrs,
            "products": results,
            "text": "I found these visually similar products based on your image."
        }
    except Exception as e:
        logger.error(f"Error parsing Gemini Vision response: {e}")
        return {
            "text": "I had trouble identifying that image. Could you try taking another one?",
            "products": []
        }

# Proxy for Speechmatics WebSocket
@app.websocket("/ws/speech")
async def speech_websocket(websocket: WebSocket):
    await websocket.accept()
    
    # FR-103: Connect to Speechmatics Real-Time API
    # wss://eu2.rt.speechmatics.com/v2
    # In this MVP, we need to relay audio chunks.
    # Due to complexity and need for valid tokens, we'll implement a mock fallback here
    # or the actual relay if the token is valid.
    
    # Mocking for hackathon/development if no key is present:
    if not SPEECHMATICS_API_KEY or SPEECHMATICS_API_KEY == "mock":
        try:
            while True:
                data = await websocket.receive_bytes()
                # Simulate partial transcript
                await websocket.send_json({
                    "message": "AddPartialTranscript",
                    "metadata": {"transcript": "Listening..."}
                })
        except WebSocketDisconnect:
            pass
        return
        
    # Real implementation using websockets library
    import websockets as ws_client
    sm_url = f"wss://eu2.rt.speechmatics.com/v2"
    
    try:
        async with ws_client.connect(sm_url, extra_headers={"Authorization": f"Bearer {SPEECHMATICS_API_KEY}"}) as sm_ws:
            # Send StartRecognition
            start_msg = {
                "message": "StartRecognition",
                "audio_format": {"type": "file"},
                "transcription_config": {"language": "en"}
            }
            await sm_ws.send(json.dumps(start_msg))
            
            async def receive_from_sm():
                try:
                    while True:
                        msg = await sm_ws.recv()
                        await websocket.send_text(msg)
                except Exception:
                    pass

            import asyncio
            task = asyncio.create_task(receive_from_sm())

            try:
                while True:
                    data = await websocket.receive_bytes()
                    await sm_ws.send(data)
            except WebSocketDisconnect:
                pass
            finally:
                task.cancel()
    except Exception as e:
        logger.error(f"Speechmatics connection error: {e}")
        await websocket.close(code=1011)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
