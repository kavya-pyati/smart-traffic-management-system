import os
from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from database import db, User, RouteHistory, TrafficComment, init_db

app = Flask(__name__)
app.secret_key = os.urandom(24) # In production, use a consistent secret key
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///traffic.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

init_db(app)

@app.route('/')
def index():
    return render_template('index.html')

# --- Authentication Routes ---
@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        name = request.form.get('name')
        email = request.form.get('email')
        password = request.form.get('password')
        role = request.form.get('role') # 'normal' or 'emergency'
        
        user = User.query.filter_by(email=email).first()
        if user:
            flash('Email already exists.', 'danger')
            return redirect(url_for('signup'))
            
        status = 'approved' if role == 'normal' else 'pending'
        new_user = User(
            name=name,
            email=email,
            password_hash=generate_password_hash(password),
            role=role,
            status=status
        )
        db.session.add(new_user)
        db.session.commit()
        
        flash('Signup successful! Please login.', 'success')
        return redirect(url_for('login'))
        
    return render_template('signup.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        
        user = User.query.filter_by(email=email).first()
        if user and check_password_hash(user.password_hash, password):
            if user.status == 'pending':
                flash('Your emergency account is pending admin approval.', 'warning')
                return redirect(url_for('login'))
                
            session['user_id'] = user.id
            session['role'] = user.role
            
            if user.role == 'admin':
                return redirect(url_for('admin_dashboard'))
            else:
                return redirect(url_for('dashboard'))
                
        flash('Invalid credentials.', 'danger')
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

# --- User Dashboard & Routing ---
@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session or session['role'] == 'admin':
        return redirect(url_for('login'))
    
    user = User.query.get(session['user_id'])
    return render_template('dashboard.html', user=user)

@app.route('/api/save_route', methods=['POST'])
def save_route():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
        
    data = request.json
    new_route = RouteHistory(
        user_id=session['user_id'],
        source=data.get('source'),
        destination=data.get('destination'),
        route_type=data.get('route_type')
    )
    db.session.add(new_route)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/comments', methods=['GET', 'POST'])
def api_comments():
    if request.method == 'POST':
        if 'user_id' not in session:
            return jsonify({'error': 'Unauthorized'}), 401
            
        data = request.json
        new_comment = TrafficComment(
            user_id=session['user_id'],
            route_name=data.get('route_name'),
            comment=data.get('comment')
        )
        db.session.add(new_comment)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Comment added'})
        
    else: # GET
        # Fetch the top 10 most recent comments
        comments = TrafficComment.query.order_by(TrafficComment.timestamp.desc()).limit(10).all()
        result = []
        for c in comments:
            result.append({
                'id': c.id,
                'user_name': c.user.name,
                'route_name': c.route_name,
                'comment': c.comment,
                'timestamp': c.timestamp.strftime('%Y-%m-%d %H:%M:%S')
            })
        return jsonify(result)

# --- Admin Dashboard ---
@app.route('/admin')
def admin_dashboard():
    if 'user_id' not in session or session['role'] != 'admin':
        return redirect(url_for('login'))
        
    pending_users = User.query.filter_by(status='pending').all()
    recent_routes = RouteHistory.query.order_by(RouteHistory.timestamp.desc()).limit(10).all()
    user_count = User.query.count()
    route_count = RouteHistory.query.count()
    
    return render_template('admin.html', 
                           pending_users=pending_users,
                           recent_routes=recent_routes,
                           user_count=user_count,
                           route_count=route_count)

@app.route('/admin/approve/<int:user_id>')
def approve_user(user_id):
    if 'user_id' not in session or session['role'] != 'admin':
        return redirect(url_for('login'))
        
    user = User.query.get(user_id)
    if user:
        user.status = 'approved'
        db.session.commit()
        flash(f'User {user.name} approved.', 'success')
    return redirect(url_for('admin_dashboard'))

@app.route('/admin/reject/<int:user_id>')
def reject_user(user_id):
    if 'user_id' not in session or session['role'] != 'admin':
        return redirect(url_for('login'))
        
    user = User.query.get(user_id)
    if user:
        db.session.delete(user)
        db.session.commit()
        flash(f'User {user.name} rejected and removed.', 'danger')
    return redirect(url_for('admin_dashboard'))

# --- Traffic Prediction Mock API ---
@app.route('/api/traffic_prediction')
def traffic_prediction():
    # Mock data for chart
    data = {
        'labels': ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'],
        'congestion': [80, 60, 40, 50, 70, 90, 50]
    }
    return jsonify(data)

@app.route('/api/nearby_traffic_prediction')
def nearby_traffic_prediction():
    lat = float(request.args.get('lat', 37.7749))
    lng = float(request.args.get('lng', -122.4194))
    pred_type = request.args.get('type', 'weekday')
    
    import random
    points = []
    
    if pred_type == 'weekday':
        # Industrial Hubs
        for i in range(4):
            points.append({
                'lat': lat + (random.random() - 0.5) * 0.1,
                'lng': lng + (random.random() - 0.5) * 0.1,
                'radius': 1500 + random.random() * 1000,
                'color': 'red',
                'description': f'Industrial Cluster {i+1}: High weekday congestion'
            })
    else:
        # Picnic Spots
        for i in range(5):
            points.append({
                'lat': lat + (random.random() - 0.5) * 0.12,
                'lng': lng + (random.random() - 0.5) * 0.12,
                'radius': 1200 + random.random() * 1500,
                'color': '#f77f00',
                'description': f'Picnic Spot {i+1}: High weekend leisure traffic'
            })
            
    return jsonify({'points': points})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
