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
def homepage():
    return render_template('homePage.html')



@app.route('/index')
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
    start_node = nodes_df.loc[nodes_df['Type'] == 'Elevator', 'NodeID'].iloc[0]

    if start_node not in graph:
        return jsonify({'error': f'Start node {start_node} not found in graph'}), 404

    if destination not in graph:
        return jsonify({'error': f'Destination node {destination} not found in graph'}), 404

    path = find_shortest_path(graph, start_node, destination, nodes_df)

    if path:
        path_coords, img_width, img_height = get_path_coordinates_and_image_size(nodes_df, path, plan_df)

        #  เพิ่มส่วนนี้เพื่อแม็พ NodeID → Detail
        path_details = []
        for node_id in path:
            row = nodes_df[nodes_df['NodeID'] == node_id]
            if not row.empty:
                path_details.append({
                    "node_id": node_id,
                    "detail": str(row.iloc[0]['Detail']) if 'Detail' in row else node_id
                })
            else:
                path_details.append({"node_id": node_id, "detail": node_id})

        result = {
            'path': path_coords,
            'nodes': path_details,  # แทนที่ list เดิม
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
    floors = nodes_df[nodes_df['B_ID'] == b_id]['floor'].unique().tolist()
    return jsonify(floors)


@app.route('/get_rooms/<int:b_id>/<int:floor>', methods=['GET'])
def get_rooms(b_id, floor):
    nodes_df = pd.read_csv('nodes.csv')
    filtered_df = nodes_df[
        (nodes_df['B_ID'] == b_id) &
        (nodes_df['floor'] == floor) &
        (nodes_df['Type'].isin(['Room', 'Toilet']))
        ]
    rooms = filtered_df[['NodeID', 'Detail']].to_dict(orient='records')
    return jsonify(rooms)


@app.route('/search', methods=['GET'])
def search():
    try:
        # Get and validate query
        query = request.args.get('q', '').strip()
        if not query:
            return jsonify([])

        query_lower = query.lower()

        # Load data
        try:
            building_df = pd.read_csv('Building.csv')
            nodes_df = pd.read_csv('nodes.csv')
        except FileNotFoundError as e:
            return jsonify({
                'error': 'Data file not found',
                'message': str(e)
            }), 500

        # Search buildings
        building_results = search_buildings(building_df, query_lower)

        # Search rooms/toilets
        room_results = search_rooms(nodes_df, query_lower)

        # Combine and return results
        all_results = building_results + room_results

        return jsonify(all_results)

    except Exception as e:
        app.logger.error(f"Search error: {str(e)}")
        return jsonify({
            'error': 'An error occurred during search',
            'message': str(e)
        }), 500


def search_buildings(building_df, query_lower):
    """Search for buildings by name and detail keywords"""
    if building_df.empty:
        return []

    results = []

    for _, row in building_df.iterrows():
        if matches_building(row, query_lower):
            try:
                result = {
                    'type': 'building',
                    'id': safe_int_convert(row.get('B_ID')),
                    'name': safe_str_convert(row.get('Name')),
                    'detail': safe_str_convert(row.get('detail')),
                    'floor': safe_int_convert(row.get('Floor')),
                    'keywords': parse_keywords(row.get('detail'))
                }
                results.append(result)
            except Exception as e:
                app.logger.warning(f"Error processing building row: {e}")
                continue

    return results


def search_rooms(nodes_df, query_lower):
    """Search for rooms and toilets by detail and keywords"""
    if nodes_df.empty:
        return []

    # Filter for Room and Toilet types only
    filtered_nodes = nodes_df[nodes_df['Type'].isin(['Room', 'Toilet'])].copy()

    results = []

    for _, row in filtered_nodes.iterrows():
        if matches_room(row, query_lower):
            try:
                result = {
                    'type': 'room',
                    'id': safe_str_convert(row.get('NodeID')),
                    'name': safe_str_convert(row.get('Detail')),
                    'building_id': safe_int_convert(row.get('B_ID')),
                    'floor': safe_int_convert(row.get('floor')),
                    'keywords': parse_keywords(row.get('keyword'))
                }
                results.append(result)
            except Exception as e:
                app.logger.warning(f"Error processing room row: {e}")
                continue

    return results


def matches_building(row, query_lower):
    """Check if building matches the search query"""
    # Check name
    name = safe_str_convert(row.get('Name'))
    if name and query_lower in name.lower():
        return True

    # Check detail (full text match)
    detail = safe_str_convert(row.get('detail'))
    if detail and query_lower in detail.lower():
        return True

    # Check keywords (individual keyword match)
    keywords = parse_keywords(row.get('detail'))
    return any(query_lower in keyword.lower() for keyword in keywords)


def matches_room(row, query_lower):
    """Check if room matches the search query"""
    # Check detail/name
    detail = safe_str_convert(row.get('Detail'))
    if detail and query_lower in detail.lower():
        return True

    # Check keywords
    keywords = parse_keywords(row.get('keyword'))
    return any(query_lower in keyword.lower() for keyword in keywords)


def parse_keywords(keywords_str):
    """Parse comma-separated keywords string into a list"""
    if pd.isna(keywords_str) or not keywords_str:
        return []

    keywords = str(keywords_str).split(',')
    return [kw.strip() for kw in keywords if kw.strip()]


def safe_str_convert(value):
    """Safely convert value to string, return None for null values"""
    if pd.isna(value) or value is None:
        return None
    return str(value)


def safe_int_convert(value):
    """Safely convert value to integer, return None for invalid values"""
    if pd.isna(value) or value is None:
        return None

    try:
        return int(float(value))  # Handle float strings like "1.0"
    except (ValueError, TypeError):
        return None



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