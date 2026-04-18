import os
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='normal') # 'normal', 'emergency', 'admin'
    status = db.Column(db.String(20), nullable=False, default='approved') # normal='approved', emergency='pending'

class RouteHistory(db.Model):
    __tablename__ = 'routes_history'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    source = db.Column(db.String(255), nullable=False)
    destination = db.Column(db.String(255), nullable=False)
    route_type = db.Column(db.String(50), nullable=False)
    timestamp = db.Column(db.DateTime, default=db.func.current_timestamp())

class TrafficComment(db.Model):
    __tablename__ = 'traffic_comments'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    route_name = db.Column(db.String(255), nullable=False)
    comment = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=db.func.current_timestamp())
    user = db.relationship('User', backref=db.backref('comments', lazy=True))

def init_db(app):
    db.init_app(app)
    with app.app_context():
        db.create_all()
        # Seed an admin user
        if not User.query.filter_by(email='admin@traffic.local').first():
            new_admin = User(
                name='Admin User',
                email='admin@traffic.local',
                password_hash=generate_password_hash('admin123'),
                role='admin',
                status='approved'
            )
            db.session.add(new_admin)
            db.session.commit()
