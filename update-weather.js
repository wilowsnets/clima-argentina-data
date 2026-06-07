const fs = require('fs');

async function updateWeather() {
  try {
    const rawData = fs.readFileSync('localidades-argentina.json');
    const localidades = JSON.parse(rawData);
    
    const CHUNK_SIZE = 35; // Reducimos un poco el lote porque ahora pedimos muchísimos más datos
    let weatherResults = [];
    
    for (let i = 0; i < localidades.length; i += CHUNK_SIZE) {
      const chunk = localidades.slice(i, i + CHUNK_SIZE);
      const lats = chunk.map(loc => loc.lat).join(',');
      const lons = chunk.map(loc => loc.lon).join(',');
      
      // API 1: Clima Ultra-Detallado (Incluye radiación, rocío, visibilidad, probabilidad de lluvia y ráfagas)
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure,cloud_cover,visibility,dew_point_2m,shortwave_radiation&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max,precipitation_sum&timezone=America/Argentina/Buenos_Aires&forecast_days=7`;
      
      // API 2: Calidad del Aire (AQI)
      const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lons}&current=us_aqi&timezone=America/Argentina/Buenos_Aires`;
      
      const [weatherRes, aqiRes] = await Promise.all([
        fetch(weatherUrl),
        fetch(aqiUrl)
      ]);

      if (!weatherRes.ok || !aqiRes.ok) throw new Error('Error conectando a las APIs meteorológicas');
      
      const weatherData = await weatherRes.json();
      const aqiData = await aqiRes.json();
      
      const wArray = Array.isArray(weatherData) ? weatherData : [weatherData];
      const aArray = Array.isArray(aqiData) ? aqiData : [aqiData];
      
      chunk.forEach((loc, index) => {
        const w = wArray[index];
        const a = aArray[index];
        
        // Recortar horas para que el archivo no pese demasiado (Solo las próximas 24hs desde ahora)
        const currentHourIndex = new Date().getHours();
        const next24 = currentHourIndex + 24;

        weatherResults.push({
          id: loc.id,
          nombre: loc.n,
          provincia: loc.p,
          lat: loc.lat,
          lon: loc.lon, // Añadimos lat/lon al JSON final para el radar de lluvia
          actual: {
            temp: w.current.temperature_2m,
            st: w.current.apparent_temperature,
            hum: w.current.relative_humidity_2m,
            viento: w.current.wind_speed_10m,
            viento_dir: w.current.wind_direction_10m,
            rafagas: w.current.wind_gusts_10m,
            lluvia: w.current.precipitation,
            codigo: w.current.weather_code,
            presion: w.current.surface_pressure,
            nubes: w.current.cloud_cover,
            visibilidad: w.current.visibility, // Viene en metros
            rocio: w.current.dew_point_2m,
            radiacion: w.current.shortwave_radiation,
            aqi: a.current.us_aqi
          },
          horas: {
            tiempos: w.hourly.time.slice(currentHourIndex, next24),
            temps: w.hourly.temperature_2m.slice(currentHourIndex, next24),
            lluvia: w.hourly.precipitation.slice(currentHourIndex, next24),
            prob_lluvia: w.hourly.precipitation_probability.slice(currentHourIndex, next24),
            codigo: w.hourly.weather_code.slice(currentHourIndex, next24),
            viento: w.hourly.wind_speed_10m.slice(currentHourIndex, next24),
            viento_dir: w.hourly.wind_direction_10m.slice(currentHourIndex, next24)
          },
          dias: {
            tiempos: w.daily.time,
            max: w.daily.temperature_2m_max,
            min: w.daily.temperature_2m_min,
            codigo: w.daily.weather_code,
            amanecer: w.daily.sunrise[0], // Amanecer de hoy
            atardecer: w.daily.sunset[0], // Atardecer de hoy
            uv: w.daily.uv_index_max[0],
            prob_lluvia: w.daily.precipitation_probability_max,
            lluvia_suma: w.daily.precipitation_sum
          }
        });
      });
    }

    const finalOutput = {
      ultimaActualizacion: new Date().toISOString(),
      mensaje: "Datos Premium V2 procesados con éxito.",
      clima: weatherResults
    };

    fs.writeFileSync('clima-argentina.json', JSON.stringify(finalOutput));
    console.log(`¡Motor Definitivo actualizado! Se guardaron datos hiper-detallados de ${weatherResults.length} zonas.`);

  } catch (error) {
    console.error('Error crítico en el motor avanzado:', error);
    process.exit(1);
  }
}

updateWeather();
