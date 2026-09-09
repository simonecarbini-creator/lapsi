#!/usr/bin/env python3

import json
import os
import threading
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from datetime import datetime

DATA_FILE = Path(__file__).parent / 'athletes-data.json'

def load_athletes():
    """Load athletes from JSON file."""
    if DATA_FILE.exists():
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return []
    return []

def save_athletes(athletes):
    """Save athletes to JSON file."""
    try:
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(athletes, f, indent=2, ensure_ascii=False)
        return True
    except IOError as e:
        print(f'Error saving athletes: {e}')
        return False

class APIHandler(SimpleHTTPRequestHandler):
    """Handle both static files and API endpoints."""
    
    def end_headers(self):
        """Override to add no-cache headers to all responses."""
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
    
    def do_GET(self):
        """Handle GET requests."""
        parsed = urlparse(self.path)
        
        if parsed.path == '/api/athletes':
            athletes = load_athletes()
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(athletes).encode('utf-8'))
        else:
            super().do_GET()
    
    def do_POST(self):
        """Handle POST requests."""
        parsed = urlparse(self.path)
        
        if parsed.path == '/api/athletes':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            
            try:
                data = json.loads(body)
                athletes = load_athletes()
                
                if isinstance(data, list):
                    athletes = data
                else:
                    athlete_id = data.get('id')
                    if athlete_id:
                        existing = next((a for a in athletes if a['id'] == athlete_id), None)
                        if existing:
                            athletes = [a if a['id'] != athlete_id else data for a in athletes]
                        else:
                            athletes.append(data)
                
                success = save_athletes(athletes)
                
                self.send_response(200 if success else 500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'success': success}).encode('utf-8'))
            except json.JSONDecodeError:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Invalid JSON'}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_DELETE(self):
        """Handle DELETE requests."""
        parsed = urlparse(self.path)
        
        if parsed.path.startswith('/api/athletes/'):
            athlete_id = parsed.path.replace('/api/athletes/', '')
            athletes = load_athletes()
            athletes = [a for a in athletes if a.get('id') != athlete_id]
            success = save_athletes(athletes)
            
            self.send_response(200 if success else 500)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'success': success}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def log_message(self, format, *args):
        """Suppress default logging."""
        if '/api/' in args[0]:
            print(f'[{datetime.now().strftime("%H:%M:%S")}] {self.address_string()} - {format % args}')

if __name__ == '__main__':
    PORT = 8000
    server = HTTPServer(('0.0.0.0', PORT), APIHandler)
    print(f'Server running on port {PORT}')
    print(f'Data file: {DATA_FILE}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nServer stopped.')
        server.server_close()
