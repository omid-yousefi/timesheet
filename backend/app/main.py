from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.middleware import SlowAPIMiddleware
from app.core.config import settings
from app.api.routes import auth, me, tasks, timesheets, analytics, manager, admin

app = FastAPI(title='Enterprise Timesheet & Productivity Analytics API', version='1.0.0')
app.add_middleware(CORSMiddleware, allow_origins=[x.strip() for x in settings.cors_origins.split(',')], allow_credentials=True, allow_methods=['*'], allow_headers=['*'])
app.state.limiter = Limiter(key_func=get_remote_address, default_limits=['120/minute'])
app.add_middleware(SlowAPIMiddleware)

@app.get('/health')
def health():
    return {'status': 'ok'}

app.include_router(auth.router)
app.include_router(me.router)
app.include_router(tasks.router)
app.include_router(timesheets.router)
app.include_router(analytics.router)
app.include_router(manager.router)
app.include_router(admin.router)
