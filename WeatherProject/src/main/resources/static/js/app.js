const GEO_URL     = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";
let charts = {};

// ── WEATHER THEMES ────────────────────────────
function applyWeatherTheme(weatherCode, isNight) {
  const body = document.body;
  body.classList.remove("theme-sunny","theme-cloudy","theme-rainy","theme-stormy","theme-foggy","theme-night");

  if (isNight)                          body.classList.add("theme-night");
  else if ([0,1].includes(weatherCode)) body.classList.add("theme-sunny");
  else if ([2,3].includes(weatherCode)) body.classList.add("theme-cloudy");
  else if ([45,48].includes(weatherCode)) body.classList.add("theme-foggy");
  else if ([51,53,55,61,63,65,80,81,82].includes(weatherCode)) body.classList.add("theme-rainy");
  else if ([71,73,75,77,85,86].includes(weatherCode)) body.classList.add("theme-cloudy");
  else if ([95,96,99].includes(weatherCode)) body.classList.add("theme-stormy");
  else body.classList.add("theme-sunny");

  // Update banner
  const banner = document.getElementById("weatherBanner");
  if (banner) {
    const themes = {
      "theme-sunny":  "☀️  Clear skies detected — warm and bright",
      "theme-cloudy": "☁️  Overcast conditions — clouds rolling in",
      "theme-rainy":  "🌧️  Rain detected — good time to skip irrigation",
      "theme-stormy": "⛈️  Storm alert — keep crops protected",
      "theme-foggy":  "🌫️  Foggy conditions — low visibility",
      "theme-night":  "🌙  Night mode — cooler temperatures ahead"
    };
    const activeTheme = [...body.classList].find(c => c.startsWith("theme-"));
    banner.textContent = themes[activeTheme] || "";
  }
}

// ── NAVBAR ────────────────────────────────────
window.addEventListener("scroll", () => {
  const links    = document.querySelectorAll(".nav-link");
  const sections = document.querySelectorAll("section[id]");
  let current = "";
  sections.forEach(s => { if (window.scrollY >= s.offsetTop - 100) current = s.id; });
  links.forEach(l => l.classList.toggle("active", l.getAttribute("href") === `#${current}`));
});

document.getElementById("hamburger").addEventListener("click", () => {
  document.getElementById("mobileMenu").classList.toggle("open");
});

// ── SEARCH TRIGGERS ───────────────────────────
document.getElementById("searchBtn").addEventListener("click", handleSearch);
document.getElementById("cityInput").addEventListener("keydown", e => { if (e.key === "Enter") handleSearch(); });
document.querySelectorAll(".city-pill").forEach(btn => {
  btn.addEventListener("click", () => {
    document.getElementById("cityInput").value = btn.dataset.city;
    handleSearch();
  });
});

// ── MAIN HANDLER ──────────────────────────────
async function handleSearch() {
  const city = document.getElementById("cityInput").value.trim();
  const crop = document.getElementById("cropSelect").value;
  if (!city) { setError("Please enter a village or city name."); return; }
  setError(""); showLoader(true);
  document.getElementById("weatherDisplay").style.display = "none";
  document.getElementById("adviceSection").style.display = "none";

  try {
    const geo = await fetchJSON(`${GEO_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
    if (!geo.results?.length) throw new Error(`Location "${city}" not found. Try a nearby town.`);
    const { latitude, longitude, name, country } = geo.results[0];

    const params = new URLSearchParams({
      latitude, longitude,
      current: "temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,cloudcover,surface_pressure,weather_code,is_day",
      daily:   "temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode",
      forecast_days: 7,
      timezone: "auto"
    });
    const wx = await fetchJSON(`${WEATHER_URL}?${params}`);

    showLoader(false);

    // Apply theme based on weather + day/night
    const isNight = wx.current.is_day === 0;
    applyWeatherTheme(wx.current.weather_code, isNight);

    renderCurrent(wx.current, `${name}, ${country}`, isNight);
    renderForecast(wx.daily);
    renderCharts(wx.daily);
    updateHeroCards(wx.current, wx.daily);
    if (crop) renderAdvice(crop, wx.current, wx.daily);

  } catch (err) {
    showLoader(false);
    setError(err.message);
  }
}

// ── CURRENT WEATHER ───────────────────────────
function renderCurrent(c, cityLabel, isNight) {
  document.getElementById("cityName").textContent         = cityLabel;
  document.getElementById("wTemp").textContent            = `${c.temperature_2m} °C`;
  document.getElementById("wHumid").textContent           = `${c.relative_humidity_2m} %`;
  document.getElementById("wWind").textContent            = `${c.wind_speed_10m} km/h`;
  document.getElementById("wPrecip").textContent          = `${c.precipitation} mm`;
  document.getElementById("wCloud").textContent           = `${c.cloudcover} %`;
  document.getElementById("wPressure").textContent        = `${c.surface_pressure} hPa`;
  document.getElementById("weatherCondition").textContent = (isNight ? "🌙 " : "") + weatherCodeLabel(c.weather_code);
  document.getElementById("weatherDisplay").style.display = "block";
}

// ── HERO CARDS ────────────────────────────────
function updateHeroCards(c, daily) {
  document.getElementById("hero-temp").textContent  = `${c.temperature_2m}°C`;
  document.getElementById("hero-rain").textContent  = `${daily.precipitation_sum[0]} mm`;
  document.getElementById("hero-humid").textContent = `${c.relative_humidity_2m}%`;
}

// ── 7 DAY FORECAST ────────────────────────────
function renderForecast(daily) {
  const strip = document.getElementById("forecastStrip");
  strip.innerHTML = "";
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  daily.time.forEach((dateStr, i) => {
    const date    = new Date(dateStr);
    const dayName = i === 0 ? "Today" : days[date.getDay()];
    const maxT    = daily.temperature_2m_max[i];
    const minT    = daily.temperature_2m_min[i];
    const rain    = daily.precipitation_sum[i];
    const icon    = weatherIcon(daily.weathercode[i]);

    const card = document.createElement("div");
    card.className = "forecast-day";
    card.innerHTML = `
      <span class="f-day">${dayName}</span>
      <span class="f-icon">${icon}</span>
      <span class="f-temp">${maxT}° / ${minT}°</span>
      <span class="f-rain">🌧 ${rain} mm</span>
    `;
    strip.appendChild(card);
  });
}

// ── CHARTS ────────────────────────────────────
function renderCharts(daily) {
  const labels = daily.time.map((d, i) => i === 0 ? "Today" : new Date(d).toLocaleDateString("en-IN", { weekday: "short" }));
  const accent  = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  makeChart("tempChart", labels, daily.temperature_2m_max, "Max Temp (°C)", accent || "#f4a234", "line");
  makeChart("rainChart", labels, daily.precipitation_sum,  "Rainfall (mm)", "#4a9edd", "bar");
}

function makeChart(id, labels, data, label, color, type) {
  if (charts[id]) charts[id].destroy();
  const ctx = document.getElementById(id).getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, 220);
  gradient.addColorStop(0, color + "55");
  gradient.addColorStop(1, color + "00");

  charts[id] = new Chart(ctx, {
    type,
    data: {
      labels,
      datasets: [{ label, data, borderColor: color, backgroundColor: type === "line" ? gradient : color + "99", borderWidth: 2, pointRadius: 3, tension: 0.4, fill: type === "line" }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: "#1f1408", borderColor: color, borderWidth: 1, titleColor: "#f5e6d0", bodyColor: color }
      },
      scales: {
        x: { ticks: { color: "#9a7a5a", font: { family: "Space Mono", size: 10 } }, grid: { color: "#3a2a1a" } },
        y: { ticks: { color: "#9a7a5a", font: { family: "Space Mono", size: 10 } }, grid: { color: "#3a2a1a" } }
      }
    }
  });
}

// ── CROP ADVICE ENGINE ────────────────────────
function renderAdvice(crop, current, daily) {
  const temp         = current.temperature_2m;
  const humidity     = current.relative_humidity_2m;
  const wind         = current.wind_speed_10m;
  const rain         = current.precipitation;
  const rainTomorrow = daily.precipitation_sum[1] || 0;
  const weekRain     = daily.precipitation_sum.reduce((a, b) => a + b, 0);
  const advices      = [];

  // IRRIGATION
  if (rainTomorrow > 5) {
    advices.push({ type: "good", icon: "💧", heading: "Skip Irrigation Today", text: `${rainTomorrow}mm of rain expected tomorrow. Save water and skip irrigation today.` });
  } else if (temp > 35) {
    advices.push({ type: "warning", icon: "🚿", heading: "Irrigate Early Morning", text: `Temperature is ${temp}°C. Water your crops before 7am and after 6pm to reduce evaporation.` });
  } else {
    advices.push({ type: "info", icon: "💧", heading: "Normal Irrigation", text: "Weather is moderate. Follow your regular irrigation schedule today." });
  }

  // TEMPERATURE WARNINGS per crop
  const tempLimits = {
    rice:      { min: 20, max: 38, crop: "Rice" },
    wheat:     { min: 10, max: 30, crop: "Wheat" },
    tomato:    { min: 18, max: 35, crop: "Tomato" },
    cotton:    { min: 20, max: 40, crop: "Cotton" },
    maize:     { min: 18, max: 38, crop: "Maize" },
    sugarcane: { min: 20, max: 40, crop: "Sugarcane" },
    groundnut: { min: 20, max: 38, crop: "Groundnut" },
    chilli:    { min: 20, max: 35, crop: "Chilli" },
    soybean:   { min: 18, max: 35, crop: "Soybean" },
    onion:     { min: 13, max: 35, crop: "Onion" }
  };
  const limits = tempLimits[crop];
  if (limits) {
    if (temp > limits.max) {
      advices.push({ type: "danger", icon: "🌡️", heading: "Heat Stress Warning", text: `${temp}°C is too hot for ${limits.crop}. Provide shade cover and increase watering frequency.` });
    } else if (temp < limits.min) {
      advices.push({ type: "warning", icon: "❄️", heading: "Cold Stress Risk", text: `${temp}°C is below ideal for ${limits.crop}. Consider covering crops at night to retain heat.` });
    } else {
      advices.push({ type: "good", icon: "✅", heading: "Ideal Temperature", text: `${temp}°C is perfect for ${limits.crop} growth. Conditions are favorable today.` });
    }
  }

  // HUMIDITY / DISEASE RISK
  if (humidity > 80) {
    const fungalCrops = ["tomato","chilli","rice","groundnut","soybean"];
    if (fungalCrops.includes(crop)) {
      advices.push({ type: "danger", icon: "🍄", heading: "Fungal Disease Risk", text: `Humidity is ${humidity}%. High risk of fungal infection for your ${crop}. Apply neem oil or fungicide spray today.` });
    } else {
      advices.push({ type: "warning", icon: "💦", heading: "High Humidity", text: `${humidity}% humidity detected. Monitor your crops for signs of mold or disease.` });
    }
  } else if (humidity < 30) {
    advices.push({ type: "warning", icon: "🏜️", heading: "Very Dry Conditions", text: `Humidity is only ${humidity}%. Increase irrigation and consider mulching to retain soil moisture.` });
  }

  // WIND WARNING
  if (wind > 30) {
    const tallCrops = ["maize","sugarcane","wheat","cotton"];
    if (tallCrops.includes(crop)) {
      advices.push({ type: "danger", icon: "💨", heading: "Strong Wind Alert", text: `Wind at ${wind}km/h. Risk of lodging for ${crop}. Support tall plants with stakes urgently.` });
    } else {
      advices.push({ type: "warning", icon: "💨", heading: "Windy Conditions", text: `Wind speed is ${wind}km/h. Check if any plants or structures need support.` });
    }
  }

  // WEEKLY RAIN SUMMARY
  if (weekRain > 100) {
    advices.push({ type: "warning", icon: "🌊", heading: "Waterlogging Risk", text: `${weekRain}mm of rain expected this week. Ensure proper drainage to avoid root rot.` });
  } else if (weekRain < 10) {
    advices.push({ type: "warning", icon: "☀️", heading: "Dry Week Ahead", text: `Only ${weekRain}mm of rain forecast this week. Plan additional irrigation to compensate.` });
  } else {
    advices.push({ type: "good", icon: "🌦️", heading: "Good Week Ahead", text: `${weekRain}mm of rain spread across the week. Favorable conditions for your ${crop}.` });
  }

  // HARVEST TIP
  if (rain > 5 || rainTomorrow > 10) {
    advices.push({ type: "info", icon: "🌾", heading: "Delay Harvest if Possible", text: "Rain today or tomorrow may affect harvest quality. Delay by 1-2 days if crop is ready." });
  }

  // Render
  const grid = document.getElementById("adviceGrid");
  const nameEl = document.getElementById("adviceCropName");
  grid.innerHTML = "";
  nameEl.textContent = crop.charAt(0).toUpperCase() + crop.slice(1);

  advices.forEach(a => {
    const card = document.createElement("div");
    card.className = `advice-card ${a.type}`;
    card.innerHTML = `
      <span class="advice-icon">${a.icon}</span>
      <span class="advice-heading">${a.heading}</span>
      <span class="advice-text">${a.text}</span>
    `;
    grid.appendChild(card);
  });

  document.getElementById("adviceSection").style.display = "block";
}

// ── HELPERS ───────────────────────────────────
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
  return res.json();
}
function showLoader(show) { document.getElementById("loader").classList.toggle("show", show); }
function setError(msg)    { document.getElementById("errorMsg").textContent = msg; }

function weatherCodeLabel(code) {
  const map = { 0:"Clear Sky",1:"Mainly Clear",2:"Partly Cloudy",3:"Overcast",45:"Foggy",48:"Icy Fog",51:"Light Drizzle",53:"Drizzle",55:"Heavy Drizzle",61:"Slight Rain",63:"Rain",65:"Heavy Rain",71:"Slight Snow",73:"Snow",75:"Heavy Snow",80:"Rain Showers",81:"Showers",82:"Violent Showers",95:"Thunderstorm",96:"Thunderstorm + Hail" };
  return map[code] || "Unknown";
}

function weatherIcon(code) {
  if (code === 0)                         return "☀️";
  if (code === 1)                         return "🌤️";
  if (code === 2)                         return "⛅";
  if (code === 3)                         return "☁️";
  if ([45,48].includes(code))             return "🌫️";
  if ([51,53,55,61,63,65,80,81,82].includes(code)) return "🌧️";
  if ([71,73,75,77,85,86].includes(code)) return "❄️";
  if ([95,96,99].includes(code))          return "⛈️";
  return "🌡️";
}

window.addEventListener("load", () => {
  document.getElementById("cityInput").value = "Warangal";
  handleSearch();
});