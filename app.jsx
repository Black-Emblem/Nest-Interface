import React, { useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { StaticMap, MapContext, NavigationControl} from 'react-map-gl';
import DeckGL, { GeoJsonLayer, ScenegraphLayer } from 'deck.gl';
import Gauge from 'react-svg-gauge';
import { ChatBox } from 'react-chatbox-component';
import DroneHud from "react-drone-hud";
import '/media/css/styles.css';

// Define the path to the GeoJSON file containing the airport data
const large_airports = '/geojson/large_airports.geojson';
const medium_airports = '/geojson/medium_airports.geojson';
const small_airports = '/geojson/small_airports.geojson';
const heliports = '/geojson/heliports.geojson';

// Define the initial view state of the map
const INITIAL_VIEW_STATE = {
    latitude: 37.99,
    longitude: 23.72,
    zoom: 11.39,
    bearing: 0,
    pitch: 0
}

// Mapbox tokens
const MAPBOX_ACCESS_TOKEN = '';
const MAP_STYLE = '';

const NAV_CONTROL_STYLE = {
    position: 'absolute',
    top: 10,
    left: 10  
};


// Data provided by the OpenSky Network, http://www.opensky-network.org
const DATA_URL = 'https://opensky-network.org/api/states/all';
const MODEL_URL = 'https://raw.githubusercontent.com/visgl/deck.gl-data/master/examples/scenegraph-layer/airplane.glb';
const REFRESH_TIME = 30000;

const ANIMATIONS = {
    '*': { speed: 1 }
};

const DATA_INDEX = {
    UNIQUE_ID: 0,
    CALL_SIGN: 1,
    ORIGIN_COUNTRY: 2,
    LONGITUDE: 5,
    LATITUDE: 6,
    BARO_ALTITUDE: 7,
    VELOCITY: 9,
    TRUE_TRACK: 10,
    VERTICAL_RATE: 11,
    GEO_ALTITUDE: 13,
    POSITION_SOURCE: 16
};

function verticalRateToAngle(object) {
    // Return: -90 looking up, +90 looking down
    const verticalRate = object[DATA_INDEX.VERTICAL_RATE] || 0;
    const velocity = object[DATA_INDEX.VELOCITY] || 0;
    return (-Math.atan2(verticalRate, velocity) * 180) / Math.PI;
}

function getTooltip({ object }) {
    return (
        object &&
        `\
    Call Sign: ${object[DATA_INDEX.CALL_SIGN] || ''}
    Country: ${object[DATA_INDEX.ORIGIN_COUNTRY] || ''}
    Vertical Rate: ${object[DATA_INDEX.VERTICAL_RATE] || 0} m/s
    Velocity: ${object[DATA_INDEX.VELOCITY] || 0} m/s
    Direction: ${object[DATA_INDEX.TRUE_TRACK] || 0}`
    );
}

const messages = [
    {
        "text": "Select UAV",
        "id": "1",
        "sender": {
            "name": "Server",
            "uid": "user2",
            "avatar": "/media/photos/.png",
        },

    },

    {
        "text": "client for ssh",
        "id": "2",
        "sender": {
            "name": "UAV",
            "uid": "user2",
            "avatar": "/media/photos/.png",
        },
    }
]

function Root({ sizeScale = 25, onDataLoad, gSpeed = 150, aSpeed = 178, altitude = 1, current = 17.8, bat = 98.4, value = 10 }) {

    const [data, setData] = useState(null);
    const [timer, setTimer] = useState({});

    useEffect(() => {
        fetch(DATA_URL)
            .then(resp => resp.json())
            .then(resp => {
                if (resp && resp.states && timer.id !== null) {
                    // In order to keep the animation smooth we need to always return the same
                    // objects in the exact same order. This function will discard new objects
                    // and only update existing ones.
                    let sortedData = resp.states;
                    if (data) {
                        const dataAsObj = {};
                        sortedData.forEach(entry => (dataAsObj[entry[DATA_INDEX.UNIQUE_ID]] = entry));
                        sortedData = data.map(entry => dataAsObj[entry[DATA_INDEX.UNIQUE_ID]] || entry);
                    }

                    setData(sortedData);

                    if (onDataLoad) {
                        onDataLoad(sortedData.length);
                    }
                }
            })
            .finally(() => {
                timer.nextTimeoutId = setTimeout(() => setTimer({ id: timer.nextTimeoutId }), REFRESH_TIME);
            });

        return () => {
            clearTimeout(timer.nextTimeoutId);
            timer.id = null;
        };
    }, [timer]);


    // Define the function to handle clicks on the airport points
    const onClick = info => {
        if (info.object) {
            // eslint-disable-next-line
            alert(`${info.object.properties.name} (${info.object.properties.abbrev})`);
        }
    };

    // Define the layers for the map
    const layers = [
        // Define the GeoJsonLayer to display airport points
        new GeoJsonLayer({
            id: 'large_airports',
            data: large_airports,
            // Styles
            filled: true,
            pointRadiusMinPixels: 2,
            pointRadiusScale: 15000,
            getPointRadius: f => 11 - f.properties.scalerank,
            getFillColor: [200, 0, 80, 180],
            // Interactive props
            pickable: true,
            autoHighlight: true,
            onClick
        }),
        new GeoJsonLayer({
            id: 'medium_airports',
            data: medium_airports,
            // Styles
            filled: true,
            pointRadiusMinPixels: 2,
            pointRadiusScale: 8000,
            getPointRadius: f => 11 - f.properties.scalerank,
            getFillColor: [200, 0, 80, 180],
            // Interactive props
            pickable: true,
            autoHighlight: true,
            onClick
        }),
        new GeoJsonLayer({
            id: 'small_airports',
            data: small_airports,
            // Styles
            filled: true,
            pointRadiusMinPixels: 2,
            pointRadiusScale: 5000,
            getPointRadius: f => 11 - f.properties.scalerank,
            getFillColor: [200, 0, 80, 180],
            // Interactive props
            pickable: true,
            autoHighlight: true,
            onClick
        }),
        new GeoJsonLayer({
            id: 'heliports',
            data: heliports,
            // Styles
            filled: true,
            pointRadiusMinPixels: 2,
            pointRadiusScale: 2000,
            getPointRadius: f => 11 - f.properties.scalerank,
            getFillColor: [255, 153, 51, 180],
            // Interactive props
            pickable: true,
            autoHighlight: true,
            onClick
        }),

        data &&
        new ScenegraphLayer({
            id: 'scenegraph-layer',
            data,
            pickable: true,
            sizeScale,
            scenegraph: MODEL_URL,
            _animations: ANIMATIONS,
            sizeMinPixels: 0.1,
            sizeMaxPixels: 1.5,
            getPosition: d => [
                d[DATA_INDEX.LONGITUDE] || 0,
                d[DATA_INDEX.LATITUDE] || 0,
                d[DATA_INDEX.GEO_ALTITUDE] || 0
            ],
            getOrientation: d => [verticalRateToAngle(d), -d[DATA_INDEX.TRUE_TRACK] || 0, 90],
            transitions: {
                getPosition: REFRESH_TIME * 0.9
            }
        })
    ];






    // Render the map using the DeckGL component, with the GeoJsonLayer and ArcLayer components as layers
    return (
        <div class="container">
            <div className="map-container">
                <DeckGL
                    initialViewState={INITIAL_VIEW_STATE}
                    controller={true}
                    layers={layers}
                    ContextProvider={MapContext.Provider}
                    getTooltip={getTooltip}
                >
                    <StaticMap
                        mapboxApiAccessToken={MAPBOX_ACCESS_TOKEN}
                        mapStyle={MAP_STYLE} />
                    {/* Render the NavigationControl component to allow users to zoom and pan the map */}
                    <NavigationControl style={NAV_CONTROL_STYLE} />
                </DeckGL>
            </div>
            <div class="right-container">
                <div class="chat">
                    <ChatBox messages={messages}/>
                </div>
                <div>
                    <DroneHud
                        width={ "100%" } //width in px, best if >= 500
                        height={" 35vh "} //height in px, best if >= 400
                        pitch={0} //degrees
                        roll={0} //degrees, -ve -> left bank
                        heading={120} //degrees, optional
                        airspeed={10} //left-side number, optional
                        airspeedTickSize={5} //increments to use for vertical gauge, optional
                        altitude={200} //right-side number, optional
                        altitudeTickSize={10} //optional
                    />
                </div>
            </div>
            <div class="meter-container"> 
                <table>
                    <tr>
                        <th>
                            <tr>
                                <Gauge
                                    value={gSpeed}
                                    min={0}
                                    max={200}
                                    width={200}
                                    height={200}
                                    label="Ground Speed"
                                    valueLabelStyle={{ fontSize: '32px' }}
                                    valueLabelFormatter={(value) => `${value.toFixed(0)}%`}
                                    color="#2ecc71"
                                    backgroundColor="#ecf0f1"
                                    topLabel={false}
                                    minMaxLabel={false}
                                    arcStart={-Math.PI / 2}
                                    arcEnd={Math.PI / 2}
                                />
                                <Gauge
                                    value={aSpeed}
                                    min={0}
                                    max={200}
                                    width={200}
                                    height={200}
                                    label="Air Speed"
                                    valueLabelStyle={{ fontSize: '32px' }}
                                    valueLabelFormatter={(value) => `${value.toFixed(0)}%`}
                                    color="#2ecc71"
                                    backgroundColor="#ecf0f1"
                                    topLabel={false}
                                    minMaxLabel={false}
                                    arcStart={-Math.PI / 2}
                                    arcEnd={Math.PI / 2}
                                />
                                <Gauge
                                    value={altitude}
                                    min={0}
                                    max={1000}
                                    width={200}
                                    height={200}
                                    label="Altitude"
                                    valueLabelStyle={{ fontSize: '32px' }}
                                    valueLabelFormatter={(value) => `${value.toFixed(0)}%`}
                                    color="#2ecc71"
                                    backgroundColor="#ecf0f1"
                                    topLabel={false}
                                    minMaxLabel={false}
                                    arcStart={-Math.PI / 2}
                                    arcEnd={Math.PI / 2}
                                />
                            </tr>
                        </th>
                        <th>
                            <tr>
                                <Gauge
                                    value={current}
                                    min={0}
                                    max={150}
                                    width={200}
                                    height={200}
                                    label="Current"
                                    valueLabelStyle={{ fontSize: '32px' }}
                                    valueLabelFormatter={(value) => `${value.toFixed(0)}%`}
                                    color="#2ecc71"
                                    backgroundColor="#ecf0f1"
                                    topLabel={false}
                                    minMaxLabel={false}
                                    arcStart={-Math.PI / 2}
                                    arcEnd={Math.PI / 2}
                                />
                                <Gauge
                                    value={bat}
                                    min={0}
                                    max={100}
                                    width={200}
                                    height={200}
                                    label="Battary"
                                    valueLabelStyle={{ fontSize: '32px' }}
                                    valueLabelFormatter={(value) => `${value.toFixed(0)}%`}
                                    color="#2ecc71"
                                    backgroundColor="#ecf0f1"
                                    topLabel={false}
                                    minMaxLabel={false}
                                    arcStart={-Math.PI / 2}
                                    arcEnd={Math.PI / 2}
                                />
                            </tr>
                        </th>
                        <th>
                            <tr>
                            </tr>
                        </th>
                    </tr>
                </table>
            </div>
        </div>
    );
}

/* global document */
// Find the 'container' div in the DOM, and render the Root component into it using createRoot
const container = document.body.appendChild(document.createElement('div'));
createRoot(container).render(<Root />);