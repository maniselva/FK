"""
Food Key WebSocket Manager
==========================
Manages WebSocket connections for real-time notifications.
"""

import logging
from typing import Dict, List
from fastapi import WebSocket

class ConnectionManager:
    """Manages WebSocket connections for real-time notifications"""
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}  # user_id -> [websockets]
        self.user_types: Dict[str, str] = {}  # user_id -> type (admin, restaurant, delivery, customer)
    
    async def connect(self, websocket: WebSocket, user_id: str, user_type: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        self.user_types[user_id] = user_type
        logging.info(f"WebSocket connected: {user_id} ({user_type})")
    
    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                if user_id in self.user_types:
                    del self.user_types[user_id]
        logging.info(f"WebSocket disconnected: {user_id}")
    
    async def send_to_user(self, user_id: str, message: dict):
        """Send message to a specific user"""
        if user_id in self.active_connections:
            for websocket in self.active_connections[user_id]:
                try:
                    await websocket.send_json(message)
                except Exception as e:
                    logging.error(f"Failed to send to {user_id}: {e}")
    
    async def send_to_type(self, user_type: str, message: dict):
        """Send message to all users of a specific type"""
        for user_id, utype in self.user_types.items():
            if utype == user_type:
                await self.send_to_user(user_id, message)
    
    async def broadcast(self, message: dict):
        """Send message to all connected users"""
        for user_id in self.active_connections:
            await self.send_to_user(user_id, message)
    
    async def send_location_update(self, order_id: str, customer_id: str, location_data: dict):
        """Send delivery partner location update to customer tracking the order"""
        await self.send_to_user(customer_id, {
            "type": "location_update",
            "order_id": order_id,
            "payload": location_data
        })
    
    async def send_notification(self, user_id: str, user_type: str, data: dict):
        """Send notification to a specific user"""
        await self.send_to_user(user_id, {
            "type": "notification",
            "payload": data
        })

# Global connection manager instance
ws_manager = ConnectionManager()
