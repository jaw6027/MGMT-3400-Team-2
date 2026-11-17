"""Team 2 vending inventory. Python standard library; no packages required."""
import argparse
import csv
from datetime import date, datetime, timedelta
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import io
import json
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parent


def connect(path):
    db = sqlite3.connect(path, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys = ON')
    return db


def initialize(path):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with connect(path) as db:
        db.executescript('''
        CREATE TABLE IF NOT EXISTS machines(id INTEGER PRIMARY KEY, name TEXT, location TEXT);
        CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY, machine_id INTEGER REFERENCES machines(id),
          name TEXT, category TEXT, slot TEXT, quantity INTEGER CHECK(quantity>=0), capacity INTEGER,
          threshold INTEGER, price_cents INTEGER, expires TEXT);
        CREATE TABLE IF NOT EXISTS sales(id INTEGER PRIMARY KEY, product_id INTEGER REFERENCES products(id),
          quantity INTEGER, total_cents INTEGER, recorded_at TEXT);
        ''')
        if db.execute('SELECT count(*) FROM machines').fetchone()[0]:
            return
        db.executemany('INSERT INTO machines VALUES(?,?,?)', [
            (1, 'The Daily Stop', 'Business Building · Floor 1'),
            (2, 'After Hours', 'Student Center · Floor 2')])
        sample = [
            (1, 'Sea Salt Chips', 'Snacks', 'A1', 6, 24, 8, 175, 48),
            (1, 'Trail Mix', 'Snacks', 'A2', 14, 20, 5, 225, 10),
            (1, 'Chocolate Bar', 'Sweets', 'A3', 18, 24, 6, 150, 75),
            (1, 'Spring Water', 'Drinks', 'B1', 4, 30, 10, 125, 180),
            (1, 'Sparkling Lemon', 'Drinks', 'B2', 21, 30, 8, 200, 90),
            (1, 'Oat & Honey Bar', 'Snacks', 'A4', 9, 20, 5, 200, 5),
            (2, 'Sea Salt Chips', 'Snacks', 'A1', 17, 24, 8, 175, 60),
            (2, 'Protein Bar', 'Snacks', 'A2', 3, 20, 5, 275, 12),
            (2, 'Peanut Butter Cups', 'Sweets', 'A3', 12, 24, 6, 175, 45),
            (2, 'Spring Water', 'Drinks', 'B1', 22, 30, 10, 125, 180),
            (2, 'Cold Brew Coffee', 'Drinks', 'B2', 7, 18, 6, 325, 2),
            (2, 'Fruit Gummies', 'Sweets', 'A4', 0, 24, 6, 150, -2)]
        for row in sample:
            db.execute('''INSERT INTO products(machine_id,name,category,slot,quantity,capacity,threshold,price_cents,expires)
                          VALUES(?,?,?,?,?,?,?,?,?)''', (*row[:-1], (date.today()+timedelta(days=row[-1])).isoformat()))


def snapshot(db):
    products = []
    today = date.today()
    for row in db.execute('SELECT products.*, machines.name AS machine_name FROM products JOIN machines ON machines.id=machine_id ORDER BY machine_id,slot'):
        item = dict(row)
        item['days_left'] = (date.fromisoformat(item['expires']) - today).days
        item['low_stock'] = item['quantity'] <= item['threshold']
        item['expiration_status'] = 'expired' if item['days_left'] < 0 else 'expiring' if item['days_left'] <= 14 else 'fresh'
        item['restock_needed'] = item['capacity'] - item['quantity']
        products.append(item)
    sales = [dict(row) for row in db.execute('''SELECT sales.*, products.name AS product_name, machines.name AS machine_name
        FROM sales JOIN products ON products.id=product_id JOIN machines ON machines.id=machine_id ORDER BY sales.id DESC LIMIT 50''')]
    totals = db.execute('SELECT coalesce(sum(quantity),0), coalesce(sum(total_cents),0) FROM sales WHERE substr(recorded_at,1,10)=?', (today.isoformat(),)).fetchone()
    return dict(machines=[dict(row) for row in db.execute('SELECT * FROM machines')], products=products, sales=sales,
                today=today.isoformat(), today_units=totals[0], today_revenue_cents=totals[1])


def transact(db, action, payload):
    product_id, quantity = payload.get('product_id'), payload.get('quantity')
    if type(product_id) is not int or type(quantity) is not int or quantity <= 0:
        raise ValueError('Choose a product and enter a positive whole number.')
    db.execute('BEGIN IMMEDIATE')
    product = db.execute('SELECT * FROM products WHERE id=?', (product_id,)).fetchone()
    if not product:
        raise ValueError('Product not found.')
    if action == 'sales':
        if date.fromisoformat(product['expires']) < date.today():
            raise ValueError('This product has expired. Remove the batch before recording sales.')
        if quantity > product['quantity']:
            raise ValueError(f"Only {product['quantity']} units are available.")
        db.execute('UPDATE products SET quantity=quantity-? WHERE id=?', (quantity, product_id))
        db.execute('INSERT INTO sales(product_id,quantity,total_cents,recorded_at) VALUES(?,?,?,?)',
                   (product_id, quantity, quantity*product['price_cents'], datetime.now().isoformat(timespec='seconds')))
    elif action == 'replace':
        try:
            expires = date.fromisoformat(payload.get('expires', ''))
        except (ValueError, TypeError):
            raise ValueError('Enter a valid expiration date.')
        if expires < date.today() or quantity > product['capacity']:
            raise ValueError('Use a current or future expiration date and stay within slot capacity.')
        db.execute('UPDATE products SET quantity=?, expires=? WHERE id=?', (quantity, expires.isoformat(), product_id))
    else:
        if date.fromisoformat(product['expires']) < date.today():
            raise ValueError('Expired batches cannot be restocked. Replace the batch first.')
        if product['quantity']+quantity > product['capacity']:
            raise ValueError(f"Only {product['capacity']-product['quantity']} units fit in this slot.")
        db.execute('UPDATE products SET quantity=quantity+? WHERE id=?', (quantity, product_id))
    db.commit()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, db_path, **kwargs):
        self.db_path = db_path
        super().__init__(*args, directory=str(ROOT/'static'), **kwargs)

    def reply(self, status, value):
        body = json.dumps(value).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == '/api/inventory':
            with connect(self.db_path) as db:
                self.reply(200, snapshot(db))
        elif self.path == '/api/restock.csv':
            with connect(self.db_path) as db:
                items = snapshot(db)['products']
            out = io.StringIO()
            writer = csv.writer(out)
            writer.writerow(['Machine', 'Slot', 'Product', 'On hand', 'Capacity', 'Units to add', 'Priority', 'Expiration date', 'Action'])
            for p in items:
                if p['restock_needed'] or p['expiration_status'] != 'fresh':
                    expired = p['expiration_status'] == 'expired'
                    writer.writerow([p['machine_name'], p['slot'], p['name'], p['quantity'], p['capacity'], p['capacity'] if expired else p['restock_needed'],
                                     'Low stock' if p['low_stock'] else 'Routine', p['expires'], 'Replace expired batch' if expired else 'Rotate soon' if p['expiration_status']=='expiring' else 'Refill'])
            body = out.getvalue().encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/csv; charset=utf-8')
            self.send_header('Content-Disposition', 'attachment; filename="team2-restocking.csv"')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif self.path.startswith('/api/'):
            self.reply(404, {'error': 'Not found.'})
        else:
            super().do_GET()

    def do_POST(self):
        if self.path not in ('/api/sales', '/api/restock', '/api/replace'):
            return self.reply(404, {'error': 'Not found.'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length > 4096:
                raise ValueError('Request too large.')
            payload = json.loads(self.rfile.read(length))
            if not isinstance(payload, dict):
                raise ValueError('Expected an object.')
            with connect(self.db_path) as db:
                transact(db, self.path.rsplit('/', 1)[-1], payload)
                self.reply(200, snapshot(db))
        except (ValueError, TypeError) as error:
            self.reply(400, {'error': str(error)})
        except sqlite3.Error:
            self.reply(503, {'error': 'Database unavailable. Please retry.'})


def serve():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=3000)
    parser.add_argument('--host', default='0.0.0.0')
    parser.add_argument('--db', default=str(ROOT/'data'/'inventory.sqlite3'))
    args = parser.parse_args()
    initialize(args.db)
    print(f'Team 2 inventory running on port {args.port}', flush=True)
    ThreadingHTTPServer((args.host, args.port), partial(Handler, db_path=args.db)).serve_forever()


if __name__ == '__main__':
    serve()
