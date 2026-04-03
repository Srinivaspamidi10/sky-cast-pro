const apiKey = "4a205f20b30c0fd05114aa2c4bd713d7";
let currentSpeech = null;
let forecastData = [];
let globe, clouds, aura, sunLight, renderer, scene, camera, marker;
let searchTimer;
let currentViewWeek = 0;

window.onload = () => {
    updateTime();
    setInterval(updateTime, 1000);
    initRadar();
    initEarth();
    renderFavorites();
    showGreeting();
    window.speechSynthesis.getVoices();
};

document.getElementById("cityInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        getWeather();
        document.getElementById("suggestions").innerHTML = "";
    }
});

function updateTime() {
    const now = new Date();
    document.getElementById("liveClock").innerText = now.toLocaleTimeString();
    document.getElementById("liveDate").innerText = now.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

async function showSuggestions(query) {
    const box = document.getElementById("suggestions");

    if (query.length < 2) {
        box.innerHTML = "";
        return;
    }

    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
        try {
            const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=10`);
            const data = await response.json();

            box.innerHTML = "";
            data.features.forEach(f => {
                const p = f.properties;
                const name = p.name || "";
                const district = p.district || p.county || "";
                const state = p.state || "";
                const country = p.country || "";

                const fullLabel = `${name}${district ? ', ' + district : ''}${state ? ', ' + state : ''}`;
                const locInfo = country ? country : "";

                const div = document.createElement("div");
                div.className = "suggestion-item";
                div.innerHTML = `${fullLabel} <span style="font-size:0.8em; opacity:0.7;">${locInfo}</span>`;

                div.onclick = () => {
                    document.getElementById("cityInput").value = fullLabel;
                    box.innerHTML = "";

                    const [lon, lat] = f.geometry.coordinates;
                    fetchWeatherByCoords(lat, lon, fullLabel);
                };
                box.appendChild(div);
            });
        } catch (e) {
            console.log("Suggestion system error: ", e);
        }
    }, 150);
}

function fetchWeatherByCoords(lat, lon, fullLocationLabel) {
    stopWeatherVoice();
    fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`)
        .then(res => res.json())
        .then(data => {
            if (data.cod === 200) {
                if (fullLocationLabel) data.name = fullLocationLabel;
                data.pop = 0;
                updateUI(data);
                getForecast(data.name.split(',')[0].trim());
                updateGlobeEnvironment(lat, lon, data.main.temp, data.timezone);
                document.getElementById("coordinates").innerText = `Coordinates: ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`;
            }
        });
}

document.addEventListener("click", (e) => {
    if (e.target.id !== "cityInput") {
        document.getElementById("suggestions").innerHTML = "";
    }
});

function setFemaleVoice(utterance) {
    const voices = window.speechSynthesis.getVoices();
    const targetVoice = voices.find(v =>
        v.name.includes("Google US English") ||
        v.name.includes("Samantha") ||
        v.name.includes("Zira") ||
        v.name.includes("Female")
    );

    if (targetVoice) {
        utterance.voice = targetVoice;
    }
    utterance.pitch = 1.05;
    utterance.rate = 0.90;
}

function voiceSearch() {
    window.speechSynthesis.cancel();
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Voice features not supported.");

    const recognition = new SpeechRecognition();
    const status = document.getElementById("voiceStatus");
    const micBtn = document.getElementById("micButton");
    const searchBar = document.getElementById("cityInput");

    recognition.onstart = () => {
        status.innerText = "Listening...";
        micBtn.classList.add("listening");
    };
    recognition.onend = () => {
        micBtn.classList.remove("listening");
    };

    recognition.onresult = (event) => {
        let cmd = event.results[0][0].transcript.toLowerCase();
        if (cmd.includes("location") || cmd.includes("where am i")) {
            getLocationWeather();
            return;
        }
        let city = cmd.replace("search", "").replace("weather in", "").replace("weather for", "").trim();
        if (city) {
            const displayCity = city.charAt(0).toUpperCase() + city.slice(1);
            searchBar.value = displayCity;
            status.innerText = `Recognized: "${displayCity}"`;
            getWeather();
        }
    };
    recognition.start();
}

function getWeather() {
    let inputVal = document.getElementById("cityInput").value;
    if (!inputVal) return;

    stopWeatherVoice();
    let query = inputVal.split(',')[0].trim();

    fetch(`https://api.openweathermap.org/data/2.5/weather?q=${query}&units=metric&appid=${apiKey}`)
        .then(res => res.json())
        .then(data => {
            if (data.cod === 200) {
                data.name = inputVal.includes(',') ? inputVal : data.name;
                data.pop = 0;
                updateUI(data);
                getForecast(query);
                updateGlobeEnvironment(data.coord.lat, data.coord.lon, data.main.temp, data.timezone);
                document.getElementById("coordinates").innerText = `Coordinates: ${data.coord.lat}°N, ${data.coord.lon}°E`;
            } else {
                alert("Location not found.");
            }
        });
}

function showForecastDetail(index) {
    const selected = forecastData[index];
    if (!selected) return;

    const mockData = {
        name: document.getElementById("cityName").innerText,
        sys: {
            country: ""
        },
        main: selected.main,
        weather: selected.weather,
        wind: selected.wind,
        visibility: selected.visibility || 10000,
        clouds: selected.clouds,
        coord: {
            lat: globe.lastLat || 0,
            lon: globe.lastLon || 0
        },
        pop: selected.pop || 0
    };

    updateUI(mockData);

    const dateStr = new Date(selected.dt_txt).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
    });
    document.getElementById("greeting").innerText = `Forecast Analysis: ${dateStr}`;

    stopWeatherVoice();
    const villageOnly = document.getElementById("cityName").innerText.split(',')[0].trim();
    const msg = new SpeechSynthesisUtterance(`Weather report for ${villageOnly}. The temperature will be ${Math.round(selected.main.temp)} degrees.`);
    setFemaleVoice(msg);
    window.speechSynthesis.speak(msg);
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

function updateGlobeEnvironment(lat, lon, temp, timezoneOffset) {
    if (!globe || !aura || !sunLight) return;
    globe.lastLat = lat;
    globe.lastLon = lon;

    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    globe.targetRotationY = theta - Math.PI / 2;
    clouds.targetRotationY = theta - Math.PI / 2;
    globe.isAutoSteering = true;

    const radius = 2;
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);

    if (marker) scene.remove(marker);
    const markerGeo = new THREE.CylinderGeometry(0.02, 0.001, 0.4, 12);
    const markerMat = new THREE.MeshBasicMaterial({
        color: 0x3b82f6
    });
    marker = new THREE.Mesh(markerGeo, markerMat);
    marker.position.set(x, y, z);
    marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x, y, z).normalize());
    scene.add(marker);

    const localTime = new Date(new Date().getTime() + (timezoneOffset * 1000));
    const hours = localTime.getUTCHours();
    const sunAngle = (hours / 24) * Math.PI * 2;
    sunLight.position.set(Math.cos(sunAngle) * 10, Math.sin(sunAngle) * 5, 5);

    let auraColor = 0xffffff;
    if (temp > 30) auraColor = 0xff4500;
    else if (temp < 15) auraColor = 0x00bfff;
    aura.material.color.setHex(auraColor);

    setTimeout(() => {
        globe.isAutoSteering = false;
    }, 7000);
}

async function updateUI(data) {
    const temp = Math.round(data.main.temp);
    const weather = data.weather[0].main;
    const box = document.getElementById("aiSuggestions");
    const rainChance = data.pop !== undefined ? Math.round(data.pop * 100) : 0;

    box.innerHTML = "";
    document.body.className = '';
    document.body.classList.add(`weather-${weather.toLowerCase()}`);

    document.getElementById("cityName").innerText = data.name;
    document.getElementById("temperature").innerText = `${temp}°C`;
    document.getElementById("weatherIcon").src = `https://openweathermap.org/img/wn/${data.weather[0].icon}@4x.png`;
    document.getElementById("humidity").innerText = `💧 Humidity: ${data.main.humidity}%`;
    document.getElementById("wind").innerText = `🌬️ Wind: ${data.wind.speed} m/s`;

    document.getElementById("extraWeather").innerHTML = `
        <div>Feels Like: ${Math.round(data.main.feels_like)}°</div>
        <div>Pressure: ${data.main.pressure}hPa</div>
        <div>Visibility: ${data.visibility/1000}km</div>
        <div style="font-weight:bold; color: #60a5fa;">🌧️ Rain Chances: ${rainChance}%</div>
    `;

    await fetchAQI(data.coord.lat, data.coord.lon);

    const farmAdvice = weather.includes("Rain") || rainChance > 40 ? "Natural irrigation active. Stop manual watering." : "Stable conditions. Ideal for crop maintenance.";
    const fitnessText = (temp > 15 && temp < 26 && rainChance < 30) ? "Outdoor cardio ready." : "Indoor recommended.";
    const laundryText = (data.main.humidity < 60 && rainChance < 20) ? "Optimal for drying." : "Drying will be slow.";

    box.innerHTML += `
        <div class="ai-card" style="border: 2px solid #10b981;"><span>👨‍🌾</span><strong> Farmer Assistant</strong><br><small>${farmAdvice}</small></div>
        <div class="ai-card"><span>💪</span><strong> Fitness</strong><br><small>${fitnessText}</small></div>
        <div class="ai-card"><span>👕</span><strong> Laundry</strong><br><small>${laundryText}</small></div>
    `;

    setTimeout(speakWeather, 800);
    addWeatherAnimation(weather);
}

async function fetchAQI(lat, lon) {
    try {
        const res = await fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`);
        const aqiData = await res.json();
        const aqi = aqiData.list[0].main.aqi;
        const labels = ["-", "Excellent", "Good", "Moderate", "Poor", "Hazardous"];
        document.getElementById("aqi").innerText = `Air Quality: ${labels[aqi]}`;

        let safety = aqi <= 2 ? "Breathable & Safe" : "High Particulates: Mask Recommended";
        const box = document.getElementById("aiSuggestions");
        box.innerHTML = `<div class="ai-card" style="border: 2px solid #a855f7;"><span>🫁</span><strong> Respiratory AI</strong><br><small>${safety}</small></div>` + box.innerHTML;
    } catch (e) {
        console.log("AQI Error");
    }
}

// UPDATED getForecast to include Hourly Weather Report with specific styling
function getForecast(city) {
    const header = document.querySelector(".forecast-section h3");
    if (header) header.innerText = "Weather Trends";

    fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${city}&units=metric&appid=${apiKey}`)
        .then(res => res.json())
        .then(data => {
            // 1. Hourly Section (Next 24 Hours)
            const hourlyContainer = document.getElementById("hourlyForecastContainer");
            if (hourlyContainer) {
                hourlyContainer.innerHTML = "";
                const hourlyData = data.list.slice(0, 8); // Next 8 intervals (24 hours)
                hourlyData.forEach((item, index) => {
                    const time = new Date(item.dt * 1000).getHours();
                    const ampm = time >= 12 ? 'PM' : 'AM';
                    const displayTime = time % 12 || 12;

                    // Specific label for current hour
                    const label = (index === 0) ? "NOW" : `${displayTime} ${ampm}`;

                    hourlyContainer.innerHTML += `
                        <div class="hourly-card">
                            <h4>${label}</h4>
                            <img src="https://openweathermap.org/img/wn/${item.weather[0].icon}.png">
                            <p>${Math.round(item.main.temp)}°</p>
                        </div>`;
                });
            }

            // 2. Daily Section (Original 5-Day Trend)
            const shelf = document.getElementById("forecastContainer");
            shelf.innerHTML = "";
            currentViewWeek = 0;
            forecastData = data.list.filter(item => item.dt_txt.includes("12:00:00"));
            renderForecastCards(forecastData);

            const plusBox = document.createElement("div");
            plusBox.className = "forecast-card plus-box";
            plusBox.style.border = "2px dashed #3b82f6";
            plusBox.style.cursor = "pointer";
            plusBox.innerHTML = `<h4>+</h4><p>Next 7 Days</p>`;
            plusBox.onclick = () => updateToNextWeek(city);
            shelf.appendChild(plusBox);

            drawWeatherGraph(forecastData.map(d => new Date(d.dt_txt).toLocaleDateString('en', {
                weekday: 'short'
            })), forecastData.map(d => Math.round(d.main.temp)));
        });
}

function renderForecastCards(days) {
    const shelf = document.getElementById("forecastContainer");
    days.forEach((day, index) => {
        const dayName = new Date(day.dt_txt).toLocaleDateString('en', {
            weekday: 'short'
        });
        shelf.innerHTML += `
            <div class="forecast-card" onclick="showForecastDetail(${index})" style="cursor:pointer;">
                <h4>${dayName}</h4>
                <img src="https://openweathermap.org/img/wn/${day.weather[0].icon}.png">
                <p>${Math.round(day.main.temp)}°</p>
                <small style="color: #60a5fa;">Rain: ${Math.round((day.pop || 0) * 100)}%</small>
            </div>`;
    });
}

function updateToNextWeek(city) {
    currentViewWeek++;
    const shelf = document.getElementById("forecastContainer");
    shelf.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:20px; color:#3b82f6;">Synchronizing AI Projections...</div>`;

    setTimeout(() => {
        shelf.innerHTML = "";
        const backBox = document.createElement("div");
        backBox.className = "forecast-card back-box";
        backBox.innerHTML = `<h4>←</h4><p>Back</p>`;
        backBox.onclick = (e) => {
            e.stopPropagation();
            getForecast(city);
        };
        shelf.appendChild(backBox);

        const nextWeekLabels = [];
        const nextWeekTemps = [];
        const baseDate = new Date();
        baseDate.setDate(baseDate.getDate() + (currentViewWeek * 7));

        for (let i = 0; i < 7; i++) {
            const futureDate = new Date(baseDate);
            futureDate.setDate(baseDate.getDate() + i);
            const label = futureDate.toLocaleDateString('en', {
                weekday: 'short'
            });
            const simulatedTemp = 20 + Math.floor(Math.random() * 10);
            const simulatedPop = Math.random();

            const futureCard = document.createElement("div");
            futureCard.className = "forecast-card";
            futureCard.style.borderColor = "#10b981";
            futureCard.innerHTML = `
                <small>AI Trend</small>
                <h4>${label}</h4>
                <span style="font-size:1.5em;">🌤️</span>
                <p>${simulatedTemp}°</p>
                <small style="color: #60a5fa;">Rain: ${Math.round(simulatedPop * 100)}%</small>
            `;
            shelf.appendChild(futureCard);
            nextWeekLabels.push(label);
            nextWeekTemps.push(simulatedTemp);
        }
        drawWeatherGraph(nextWeekLabels, nextWeekTemps);
    }, 800);
}

function drawWeatherGraph(labels, temps) {
    const ctx = document.getElementById("forecastChart").getContext("2d");
    if (window.weatherChart) window.weatherChart.destroy();
    window.weatherChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Temp (°C)',
                data: temps,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    ticks: {
                        color: 'white'
                    }
                },
                x: {
                    ticks: {
                        color: 'white'
                    }
                }
            }
        }
    });
}

function initEarth() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, 1.5, 0.1, 1000);
    const canvas = document.getElementById("earthCanvas");
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(canvas.parentElement.clientWidth, 450);

    const loader = new THREE.TextureLoader();
    globe = new THREE.Mesh(
        new THREE.SphereGeometry(2, 128, 128),
        new THREE.MeshPhongMaterial({
            map: loader.load("https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg"),
            specularMap: loader.load("https://threejs.org/examples/textures/planets/earth_specular_2048.jpg"),
            bumpMap: loader.load("https://threejs.org/examples/textures/planets/earth_normal_2048.jpg"),
            bumpScale: 0.05,
            shininess: 15
        })
    );
    scene.add(globe);

    clouds = new THREE.Mesh(new THREE.SphereGeometry(2.03, 128, 128), new THREE.MeshPhongMaterial({
        map: loader.load("https://threejs.org/examples/textures/planets/earth_clouds_2048.png"),
        transparent: true,
        opacity: 0.4
    }));
    scene.add(clouds);

    aura = new THREE.Mesh(new THREE.SphereGeometry(2.1, 128, 128), new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.15,
        side: THREE.BackSide
    }));
    scene.add(aura);

    sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
    sunLight.position.set(5, 3, 5);
    scene.add(sunLight);
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    camera.position.z = 5;

    function animate() {
        requestAnimationFrame(animate);
        globe.rotation.y += 0.0012;
        clouds.rotation.y += 0.0015;
        renderer.render(scene, camera);
    }
    animate();
}

function initRadar() {
    var r = L.map('radarMap').setView([20, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(r);
}

function speakWeather() {
    window.speechSynthesis.cancel();
    const fullLocation = document.getElementById("cityName").innerText;
    const shortName = fullLocation.split(',')[0].trim();
    const temp = document.getElementById("temperature").innerText;
    if (shortName === "" || shortName.includes("Ready")) return;

    const aiCards = document.querySelectorAll(".ai-card small");
    let aiSpeech = "";
    if (aiCards.length >= 3) {
        aiSpeech = ` Air quality is ${aiCards[0].innerText}. For farmers: ${aiCards[1].innerText}. Fitness AI suggests ${aiCards[2].innerText}`;
    }
    const msg = new SpeechSynthesisUtterance(`Weather report for ${shortName}. It is ${temp}. ${aiSpeech}`);
    setFemaleVoice(msg);
    window.speechSynthesis.speak(msg);
}

function stopWeatherVoice() {
    window.speechSynthesis.cancel();
}

function getLocationWeather() {
    navigator.geolocation.getCurrentPosition(async (p) => {
        const lat = p.coords.latitude;
        const lon = p.coords.longitude;
        try {
            const res = await fetch(`https://photon.komoot.io/reverse?lon=${lon}&lat=${lat}`);
            const geo = await res.json();
            const props = geo.features[0].properties;
            const fullLabel = `${props.name || "My Location"}${props.district ? ', ' + props.district : ''}${props.state ? ', ' + props.state : ''}`;
            fetchWeatherByCoords(lat, lon, fullLabel);
        } catch (e) {
            fetchWeatherByCoords(lat, lon, "My Location");
        }
    });
}

function addWeatherAnimation(weather) {
    const anim = document.getElementById("weatherAnimation");
    anim.innerHTML = "";
    if (weather.toLowerCase().includes("rain")) {
        for (let i = 0; i < 100; i++) {
            let drop = document.createElement("div");
            drop.className = "rain-drop";
            drop.style.left = Math.random() * 100 + "vw";
            drop.style.animationDuration = (Math.random() * 0.5 + 0.5) + "s";
            anim.appendChild(drop);
        }
    }
}

function showGreeting() {
    document.getElementById("greeting").innerText = new Date().getHours() < 12 ? "Good Morning, Nani" : "Good Day, Nani";
}

function renderFavorites() {
    let favorites = JSON.parse(localStorage.getItem("sky_ai_favs")) || [];
    const favBox = document.getElementById("favoriteCities");
    if (favBox) {
        favBox.innerHTML = favorites.map(f => `
            <button onclick="stopWeatherVoice(); document.getElementById('cityInput').value='${f}'; getWeather();">
                ${f.split(',')[0]}
            </button>
        `).join("");
    }
}


function getForecast(city) {
    const header = document.querySelector(".forecast-section h3");
    if (header) header.innerText = "Weather Trends";

    fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${city}&units=metric&appid=${apiKey}`)
        .then(res => res.json())
        .then(data => {
            const hourlyContainer = document.getElementById("hourlyForecastContainer");
            if (hourlyContainer) {
                hourlyContainer.innerHTML = "";
                
                for (let i = 0; i < 24; i++) {
                    const now = new Date();
                    now.setHours(now.getHours() + i, 0, 0, 0);
                    
                    const hourTimestamp = now.getTime() / 1000;
                    let prevBlock = data.list[0];
                    let nextBlock = data.list[0];
                    
                    for (let j = 0; j < data.list.length - 1; j++) {
                        if (hourTimestamp >= data.list[j].dt && hourTimestamp <= data.list[j+1].dt) {
                            prevBlock = data.list[j];
                            nextBlock = data.list[j+1];
                            break;
                        }
                    }

                    const totalDiff = nextBlock.dt - prevBlock.dt;
                    const currentDiff = hourTimestamp - prevBlock.dt;
                    const ratio = totalDiff === 0 ? 0 : currentDiff / totalDiff;
                    
                    const interpolatedTemp = prevBlock.main.temp + (nextBlock.main.temp - prevBlock.main.temp) * ratio;
                    
                    const time = now.getHours();
                    const ampm = time >= 12 ? 'PM' : 'AM';
                    const displayTime = time % 12 || 12;
                    const label = (i === 0) ? "NOW" : `${displayTime}${ampm}`;

                    hourlyContainer.innerHTML += `
                        <div class="hourly-card">
                            <h4>${label}</h4>
                            <img src="https://openweathermap.org/img/wn/${prevBlock.weather[0].icon}.png">
                            <p>${Math.round(interpolatedTemp)}°</p>
                        </div>`;
                }
            }

            const shelf = document.getElementById("forecastContainer");
            shelf.innerHTML = "";
            currentViewWeek = 0;
            forecastData = data.list.filter(item => item.dt_txt.includes("12:00:00"));
            renderForecastCards(forecastData);

            const plusBox = document.createElement("div");
            plusBox.className = "forecast-card plus-box";
            plusBox.style.border = "2px dashed #3b82f6";
            plusBox.style.cursor = "pointer";
            plusBox.innerHTML = `<h4>+</h4><p>Next 7 Days</p>`;
            plusBox.onclick = () => updateToNextWeek(city);
            shelf.appendChild(plusBox);

            drawWeatherGraph(forecastData.map(d => new Date(d.dt_txt).toLocaleDateString('en', {
                weekday: 'short'
            })), forecastData.map(d => Math.round(d.main.temp)));
        });
}



let miviAssistant = null;

function processMiviCommand(transcript) {
    window.speechSynthesis.cancel(); 

    let city = transcript.replace(/hey mivi|ok mivi|mivi|weather in|the weather in|search/g, "").trim();

    if (city) {
        const searchBar = document.getElementById("cityInput");
        const status = document.getElementById("voiceStatus");
        const displayCity = city.charAt(0).toUpperCase() + city.slice(1);
        
        searchBar.value = displayCity;
        if (status) status.innerText = `Mivi: Recognized "${displayCity}"`;

        speakMivi(`Updating location to ${displayCity}. Synchronizing Earth data.`);

        setTimeout(() => {
            getWeather(); 
        }, 1200);
    }
}

function voiceSearch() {
    window.speechSynthesis.cancel();
    if (miviAssistant) miviAssistant.stop(); 

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    const micBtn = document.getElementById("micButton");

    recognition.onstart = () => {
        micBtn.classList.add("listening"); 
        document.getElementById("voiceStatus").innerText = "Listening for location...";
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase();
        processMiviCommand(transcript); 
    };

    recognition.onend = () => {
        setTimeout(() => {
            micBtn.classList.remove("listening");
            if (miviAssistant) try { miviAssistant.start(); } catch(e){}
        }, 1000);
    };

    recognition.start();
}

function startMiviAssistant() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    miviAssistant = new SpeechRecognition();
    miviAssistant.continuous = true;
    miviAssistant.lang = 'en-US';

    miviAssistant.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
        
        if (transcript.includes("mivi") || transcript.includes("weather in")) {
            processMiviCommand(transcript); 
        }
    };

    miviAssistant.onend = () => {
        setTimeout(() => { try { miviAssistant.start(); } catch(e){} }, 400);
    };

    miviAssistant.start();
}

function speakMivi(text) {
    window.speechSynthesis.cancel(); 
    const utterance = new SpeechSynthesisUtterance(text);
    
    if (typeof setFemaleVoice === "function") setFemaleVoice(utterance);

    if (miviAssistant) miviAssistant.stop();
    utterance.onend = () => { 
        try { miviAssistant.start(); } catch(e) {} 
    };

    window.speechSynthesis.speak(utterance);
}

window.addEventListener('click', () => {
    if (!miviAssistant) {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance("")); 
        startMiviAssistant();
        speakMivi("Mivi AI system is online. Hello Nani!");
        const status = document.getElementById("voiceStatus");
        if (status) status.innerText = "Mivi: Online & Listening";
    }
}, { once: true });
