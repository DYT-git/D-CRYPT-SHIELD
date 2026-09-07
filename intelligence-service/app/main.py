from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router

app = FastAPI(
    title="VASP Intelligence Service",
    description="Risk scoring and laundering typology detection for the VASP Attribution Engine",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/intelligence")

@app.get("/health")
def health():
    return {"status": "ok", "service": "vasp-intelligence-service", "version": "1.0.0"}
