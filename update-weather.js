const fs = require('fs');

async function updateWeather() {
  try {
    const rawData = fs.readFileSync('localidades-argentina.json');
    const localidades = JSON.parse(rawData);
    
    // Configuración para agrupar llamadas (ahorra llamadas a la API)
    const CHUNK_SIZE = 40; 
    let weatherResults = [];
    
    for (let i = 0; i < localidades.length; i += CHUNK_SIZE) {
      const chunk = localidades.slice(i, i + CHUNK_SIZE);
      const lats = chunk.map(loc => loc.lat).join(',');
      const lons = chunk.map(loc => loc.lon).join(',');
      
      // API 1: Clima, Gráficos por Hora y Pronóstico de 7 Días
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&timezone=America/Argentina/Buenos_Aires&forecast_days=7`;
      
      // API 2: Calidad del Aire (AQI)
      const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lons}&current=us_aqi&timezone=America/Argentina/Buenos_Aires`;
      
      // Ejecutamos ambas APIs al mismo tiempo (como las apps profesionales)
      const [weatherRes, aqiRes] = await Promise.all([
        fetch(weatherUrl),
        fetch(aqiUrl)
      ]);

      if (!weatherRes.ok || !aqiRes.ok) throw new Error('Error conectando a las APIs');
      
      const weatherData = await weatherRes.json();
      const aqiData = await aqiRes.json();
      
      // Formateamos los datos para que el frontend los reciba listos
      const wArray = Array.isArray(weatherData) ? weatherData : [weatherData];
      const aArray = Array.isArray(aqiData) ? aqiData : [aqiData];
      
      chunk.forEach((loc, index) => {
        const w = wArray[index];
        const a = aArray[index];
        
        weatherResults.push({
          id: loc.id,
          nombre: loc.n,
          provincia: loc.p,
          actual: {
            temp: w.current.temperature_2m,
            st: w.current.apparent_temperature,
            hum: w.current.relative_humidity_2m,
            viento: w.current.wind_speed_10m,
            lluvia: w.current.precipitation,
            codigo: w.current.weather_code,
            aqi: a.current.us_aqi
          },
          // Datos para el gráfico de las próximas 24 horas
          horas: {
            tiempos: w.hourly.time.slice(0, 24),
            temps: w.hourly.temperature_2m.slice(0, 24),
            lluvia: w.hourly.precipitation.slice(0, 24),
            codigo: w.hourly.weather_code.slice(0, 24)
          },
          // Datos para el gráfico de 7 días
          dias: {
            tiempos: w.daily.time,
            max: w.daily.temperature_2m_max,
            min: w.daily.temperature_2m_min,
            codigo: w.daily.weather_code,
            amanecer: w.daily.sunrise[0],
            atardecer: w.daily.sunset[0],
            uv: w.daily.uv_index_max[0]
          }
        });
      });
    }

    const finalOutput = {
      ultimaActualizacion: new Date().toISOString(),
      mensaje: "Datos procesados con éxito. Modo Premium Activo.",
      clima: weatherResults
    };

    fs.writeFileSync('clima-argentina.json', JSON.stringify(finalOutput));
    console.log(`¡Éxito! Clima Premium actualizado para ${weatherResults.length} localidades estratégicas.`);

  } catch (error) {
    console.error('Error crítico en el motor:', error);
    process.exit(1);
  }
}

updateWeather();
