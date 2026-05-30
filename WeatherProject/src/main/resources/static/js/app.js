const GEO_URL     = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";

let charts = {};

// Navbar scroll highlight
window.addEventListener("scroll", () => {
  const links    = document.querySelectorAll(".nav-link");
  const sections = document.querySelectorAll("section[id]");
  let current = "";
  sections.forEach(s => { if (window.scrollY >= s.offsetTop - 100) current = s.id; });
  links.forEach(l => l.classList.toggle("active", l.getAttribute("href") === `#${current}`));
});

// Hamburger
document.getElementById("hamburger").addEventListener("click", () => {
  document.getElementById("mobileMenu").classList.toggle("open");
});

// Search triggers
document.getElementById("searchBtn").addEventListener("click", handleSearch);
document.getElementById("cityInput").addEventListener("keydown", e => { if (e.key === "Enter") handleSearch(); });
document.querySelectorAll(".city-pill").forEach(btn => {
  btn.addEventListener("click", () => {
    document.getElementById("cityInput").value = btn.dataset.city;
    handleSearch();
  });
});

async function handleSearch() {
  const city = document.getElementById("cityInput").value.trim();
  if (!city) return;
  setError(""); showLoader(true);
  document.getElementById("weatherDisplay").style.display = "none";

  try {
    const geo = await fetchJSON(`${GEO_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
    if (!geo.results?.length) throw new Error(`City "${city}" not found.`);
    const { latitude, longitude, name, country } = geo.results[0];

    const params = new URLSearchParams({
      latitude, longitude,
      current: "temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,visibility,surface_pressure,weather_code",
      hourly:  "temperature_2m,wind_speed_10m,precipitation,cloudcover",
      forecast_days: 1, timezone: "auto"
    });
    const wx = await fetchJSON(`${WEATHER_URL}?${params}`);

    showLoader(false);
    renderCurrent(wx.current, `${name}, ${country}`);
    renderCharts(wx.hourly);
    updateHeroCards(wx.current);
  } catch (err) {
    showLoader(false);
    setError(err.message);
  }
}

function renderCurrent(c, cityLabel) {
  document.getElementById("cityName").textContent        = cityLabel;
  document.getElementById("wTemp").textContent           = `${c.temperature_2m} °C`;
  document.getElementById("wHumid").textContent          = `${c.relative_humidity_2m} %`;
  document.getElementById("wWind").textContent           = `${c.wind_speed_10m} km/h`;
  document.getElementById("wPrecip").textContent         = `${c.precipitation} mm`;
  document.getElementById("wVis").textContent            = `${(c.visibility / 1000).toFixed(1)} km`;
  document.getElementById("wPressure").textContent       = `${c.surface_pressure} hPa`;
  document.getElementById("weatherCondition").textContent = weatherCodeLabel(c.weather_code);
  document.getElementById("weatherDisplay").style.display = "block";
}

function updateHeroCards(c) {
  document.getElementById("hero-temp").textContent  = `${c.temperature_2m}°C`;
  document.getElementById("hero-wind").textContent  = `${c.wind_speed_10m} km/h`;
  document.getElementById("hero-humid").textContent = `${c.relative_humidity_2m}%`;
}

function renderCharts(h) {
  const labels = h.time.map(t => t.slice(11, 16));
  makeChart("tempChart",   labels, h.temperature_2m, "Temperature (°C)",  "#00e5ff", "line");
  makeChart("windChart",   labels, h.wind_speed_10m, "Wind Speed (km/h)", "#ff6b35", "bar");
  makeChart("precipChart", labels, h.precipitation,  "Precipitation (mm)","#22c55e", "bar");
  makeChart("cloudChart",  labels, h.cloudcover,     "Cloud Cover (%)",   "#a78bfa", "line");
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
      datasets: [{ label, data, borderColor: color, backgroundColor: type === "line" ? gradient : color + "99", borderWidth: 2, pointRadius: type === "line" ? 2 : 0, tension: 0.4, fill: type === "line" }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: "#16161f", borderColor: color, borderWidth: 1, titleColor: "#e8e8f0", bodyColor: color }
      },
      scales: {
        x: { ticks: { color: "#7a7a9a", maxTicksLimit: 8, font: { family: "Space Mono", size: 10 } }, grid: { color: "#2a2a3a" } },
        y: { ticks: { color: "#7a7a9a", font: { family: "Space Mono", size: 10 } }, grid: { color: "#2a2a3a" } }
      }
    }
  });
}

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

window.addEventListener("load", () => {
  document.getElementById("cityInput").value = "Hyderabad";
  handleSearch();
});