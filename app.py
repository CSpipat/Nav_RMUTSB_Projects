import heapq
import json
import xml.etree.ElementTree as ET
from collections import defaultdict
import csv
import math

import networkx as nx
import numpy as np
import pandas as pd
from flask import request
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)


# Custom JSON encoder to handle NumPy types
class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        return super(NumpyEncoder, self).default(obj)


# Load indoor navigation data from CSV files
def load_data():
    building_df = pd.read_csv('Building.csv')
    nodes_df = pd.read_csv('nodes.csv')
    connections_df = pd.read_csv('Connected_Node.csv')
    connections_df.columns = ['C_ID', 'NodeID', 'ConnectedTO', 'Type']
    plan_df = pd.read_csv('Plan.csv')
    return building_df, nodes_df, connections_df, plan_df


# Create a graph for indoor navigation
def create_graph(nodes_df, connections_df):
    graph = defaultdict(list)

    for _, row in connections_df.iterrows():
        source = row['NodeID']
        if isinstance(row['ConnectedTO'], str):
            targets = row['ConnectedTO'].split(',')

            for target in targets:
                target = target.strip()

                source_node = nodes_df[nodes_df['NodeID'] == source]
                target_node = nodes_df[nodes_df['NodeID'] == target]

                if not source_node.empty and not target_node.empty:
                    source_coords = source_node[['X', 'Y']].values[0]
                    target_coords = target_node[['X', 'Y']].values[0]

                    distance = np.sqrt((source_coords[0] - target_coords[0]) ** 2 +
                                    (source_coords[1] - target_coords[1]) ** 2)

                    graph[source].append((target, distance))
                    graph[target].append((source, distance))

    return graph


def heuristic(node_a, node_b, nodes_df):
    a = nodes_df[nodes_df['NodeID'] == node_a][['X', 'Y']].values
    b = nodes_df[nodes_df['NodeID'] == node_b][['X', 'Y']].values
    if a.size == 0 or b.size == 0:
        return 0
    return np.linalg.norm(a[0] - b[0])


def find_shortest_path(graph, start, end, nodes_df):
    pq = [(heuristic(start, end, nodes_df), 0, start, [])]
    visited = set()

    while pq:
        f, g, node, path = heapq.heappop(pq)

        if node in visited:
            continue
        visited.add(node)
        path = path + [node]

        if node == end:
            return path

        for neighbor, weight in graph[node]:
            if neighbor not in visited:
                g_new = g + weight
                h = heuristic(neighbor, end, nodes_df)
                f_new = g_new + h
                heapq.heappush(pq, (f_new, g_new, neighbor, path))

    return None


def get_path_coordinates_and_image_size(nodes_df, path, plan_df):
    if not path:
        return [], 800, 600

    img_width = 800
    img_height = 600

    try:
        if 'Width' in plan_df.columns and 'Height' in plan_df.columns:
            img_width = int(plan_df['Width'].iloc[0])
            img_height = int(plan_df['Height'].iloc[0])
    except Exception as e:
        print(f"Error getting image dimensions: {e}")

    coordinates = []
    for node_id in path:
        node = nodes_df[nodes_df['NodeID'] == node_id]
        if not node.empty:
            x = float(node['X'].values[0])
            y = float(node['Y'].values[0])

            x = max(0, min(x, img_width))
            y = max(0, min(y, img_height))

            coordinates.append({
                'x': int(x),
                'y': int(y),
                'node_id': str(node_id)
            })

    return coordinates, img_width, img_height


def load_building_entries(csv_file):
    building_entries = {}
    with open(csv_file, 'r', encoding='utf-8') as file:
        reader = csv.reader(file)
        next(reader)
        for row in reader:
            building_name = row[1]
            latitude = float(row[4])
            longitude = float(row[5])
            building_entries[building_name] = (latitude, longitude)
    return building_entries


def parse_osm_footways(osm_file):
    tree = ET.parse(osm_file)
    root = tree.getroot()

    footways = []
    nodes = {}

    for node in root.findall('.//node'):
        node_id = node.get('id')
        lat = float(node.get('lat'))
        lon = float(node.get('lon'))
        nodes[node_id] = (lat, lon)

    for way in root.findall('.//way'):
        is_footway = any(tag.get('k') == 'highway' and tag.get('v') == 'footway' for tag in way.findall('tag'))

        if is_footway:
            way_coords = []
            way_nodes = []
            for nd in way.findall('nd'):
                node_id = nd.get('ref')
                if node_id in nodes:
                    way_coords.append(nodes[node_id])
                    way_nodes.append(node_id)

            if way_coords:
                footways.append(way_coords)

    return footways, nodes


def haversine(lat1, lon1, lat2, lon2):
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/indoor')
def indoor():
    _, nodes_df, _, plan_df = load_data()
    rooms = nodes_df[nodes_df['Type'].isin(['Room', 'Toilet'])]['NodeID'].tolist()
    floor_plan = plan_df['ImgPath'].iloc[0] if not plan_df.empty else 'default_plan.png'
    
    if floor_plan.startswith('/'):
        floor_plan = floor_plan[1:]

    img_width = 800
    img_height = 600

    try:
        if 'Width' in plan_df.columns and 'Height' in plan_df.columns:
            img_width = int(plan_df['Width'].iloc[0])
            img_height = int(plan_df['Height'].iloc[0])
    except Exception as e:
        print(f"Error getting image dimensions: {e}")

    return render_template('indoor.html',
                         rooms=rooms,
                         floor_plan=floor_plan,
                         img_width=img_width,
                         img_height=img_height)


@app.route('/find_path', methods=['POST'])
def get_path():
    destination = request.json.get('destination')

    if not destination:
        return jsonify({'error': 'No destination provided'}), 400

    _, nodes_df, connections_df, plan_df = load_data()
    graph = create_graph(nodes_df, connections_df)
    start_node = 'Elevator'

    if start_node not in graph:
        return jsonify({'error': f'Start node {start_node} not found in graph'}), 404

    if destination not in graph:
        return jsonify({'error': f'Destination node {destination} not found in graph'}), 404

    path = find_shortest_path(graph, start_node, destination, nodes_df)

    if path:
        path_coords, img_width, img_height = get_path_coordinates_and_image_size(nodes_df, path, plan_df)

        result = {
            'path': path_coords,
            'nodes': path,
            'img_width': img_width,
            'img_height': img_height
        }

        return app.response_class(
            response=json.dumps(result, cls=NumpyEncoder),
            status=200,
            mimetype='application/json'
        )
    else:
        return jsonify({'error': f'No path found from {start_node} to {destination}'}), 404


@app.route('/route', methods=['POST'])
def route():
    try:
        data = request.get_json()
        start_coords = tuple(data['start'])
        end_building = data['end']

        building_entries = load_building_entries('Building.csv')

        if end_building not in building_entries:
            return jsonify(error="Invalid building name"), 400

        end_coords = building_entries[end_building]

        footways, nodes = parse_osm_footways('map.osm')
        G = nx.Graph()

        for footway in footways:
            for i in range(len(footway) - 1):
                lat1, lon1 = footway[i]
                lat2, lon2 = footway[i + 1]
                dist = haversine(lat1, lon1, lat2, lon2)

                node1 = list(nodes.keys())[list(nodes.values()).index(footway[i])]
                node2 = list(nodes.keys())[list(nodes.values()).index(footway[i + 1])]

                G.add_edge(node1, node2, weight=dist)

        start_node = min(nodes.keys(),
                        key=lambda node: haversine(start_coords[0], start_coords[1], nodes[node][0], nodes[node][1]))
        end_node = min(nodes.keys(),
                      key=lambda node: haversine(end_coords[0], end_coords[1], nodes[node][0], nodes[node][1]))

        if start_node not in G or end_node not in G:
            valid_nodes = [node for node in nodes.keys() if node in G]
            if not valid_nodes:
                return jsonify(error="No valid route found"), 404

            if start_node not in G:
                start_node = min(valid_nodes,
                               key=lambda node: haversine(start_coords[0], start_coords[1], nodes[node][0],
                                                        nodes[node][1]))

            if end_node not in G:
                end_node = min(valid_nodes,
                             key=lambda node: haversine(end_coords[0], end_coords[1], nodes[node][0], nodes[node][1]))

        def heuristic(n1, n2):
            lat1, lon1 = nodes[n1]
            lat2, lon2 = nodes[n2]
            return haversine(lat1, lon1, lat2, lon2)

        path = nx.astar_path(G, source=start_node, target=end_node, weight='weight', heuristic=heuristic)
        path_coords = [nodes[node] for node in path]

        total_distance = 0
        for i in range(len(path) - 1):
            lat1, lon1 = nodes[path[i]]
            lat2, lon2 = nodes[path[i + 1]]
            segment_distance = haversine(lat1, lon1, lat2, lon2)
            total_distance += segment_distance

        total_distance_meters = round(total_distance)

        return jsonify(path_coords=path_coords, distance=total_distance_meters)

    except Exception as e:
        return jsonify(error=str(e)), 500


@app.route('/get_building_info', methods=['GET'])
def get_building_info():
    building_df = pd.read_csv('Building.csv')
    building_df = building_df.replace({np.nan: None})
    buildings = building_df.to_dict('records')
    return jsonify(buildings)


@app.route('/get_floor_info/<int:b_id>', methods=['GET'])
def get_floor_info(b_id):
    nodes_df = pd.read_csv('nodes.csv')
    floors = nodes_df[nodes_df['B_ID'] == b_id]['flor'].unique().tolist()
    return jsonify(floors)


@app.route('/get_rooms/<int:b_id>/<int:floor>', methods=['GET'])
def get_rooms(b_id, floor):
    nodes_df = pd.read_csv('nodes.csv')
    rooms = nodes_df[(nodes_df['B_ID'] == b_id) &
                    (nodes_df['flor'] == floor) &
                    (nodes_df['Type'].isin(['Room', 'Toilet']))]['NodeID'].tolist()
    return jsonify(rooms)


@app.route('/search', methods=['GET'])
def search():
    try:
        query = request.args.get('q', '').lower()
        if not query:
            return jsonify([])

        building_df = pd.read_csv('Building.csv')
        nodes_df = pd.read_csv('nodes.csv')

        building_mask = pd.Series(False, index=building_df.index)
        
        building_mask |= building_df['Name'].astype(str).str.lower().str.contains(query, na=False)
        
        def match_keywords(detail):
            if pd.isna(detail):
                return False
            keywords = str(detail).lower().split(',')
            return any(query in keyword.strip() for keyword in keywords)
        
        building_mask |= building_df['detail'].apply(match_keywords)

        building_results = building_df[building_mask].apply(lambda row: {
            'type': 'building',
            'id': int(row['B_ID']),
            'name': str(row['Name']),
            'detail': str(row['detail']) if pd.notnull(row['detail']) else None,
            'floor': int(row['Floor']),
            'keywords': [kw.strip() for kw in str(row['detail']).split(',')] if pd.notnull(row['detail']) else []
        }, axis=1).tolist()

        room_results = nodes_df[
            (nodes_df['Type'].isin(['Room', 'Toilet'])) &
            nodes_df['Detail'].astype(str).str.lower().str.contains(query, na=False)
        ].apply(lambda row: {
            'type': 'room',
            'id': str(row['NodeID']),
            'name': str(row['Detail']),
            'building_id': int(row['B_ID']),
            'floor': int(row['flor'])
        }, axis=1).tolist()

        return jsonify(building_results + room_results)
    
    except Exception as e:
        print(f"Search error: {str(e)}")
        return jsonify({
            'error': 'An error occurred during search',
            'message': str(e)
        }), 500


# ============================= Start Point feedBack=====================

import csv
from datetime import datetime

def save_rating_to_csv(rating, rating_text, file_path='feedback.csv'):
    with open(file_path, mode='a', newline='', encoding='utf-8') as file:
        writer = csv.writer(file)
        writer.writerow([datetime.now().isoformat(), rating, rating_text])


@app.route('/submit-rating', methods=['POST'])
def submit_rating():
    try:
        data = request.get_json()
        rating = data.get('rating')
        rating_text = data.get('ratingText')  # แก้จาก ratingTexts เป็น ratingText

        if not isinstance(rating, int) or rating < 1 or rating > 5:
            return jsonify({'error': 'Invalid rating value. Must be 1–5'}), 400
        if not isinstance(rating_text, str):
            return jsonify({'error': 'Invalid ratingText'}), 400

        save_rating_to_csv(rating, rating_text)

        return jsonify({'message': 'Rating saved successfully'}), 200

    except Exception as e:
        print("🔥 Error:", str(e))  # จะพิมพ์ใน terminal
        return jsonify({'error': str(e)}), 500




if __name__ == '__main__':
    app.run(debug=True)