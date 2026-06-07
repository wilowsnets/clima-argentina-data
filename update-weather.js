const fs = require('fs');

async function updateWeather() {
  try {
    const rawData = fs.readFileSync('localidades-argentina.json');
    const localidades = JSON.parse(rawData);
    
    // Configuración de Chunking (Open-Meteo acepta múltiples coordenadas, agrupamos de a 50)
    const CHUNK_SIZE = 50;
    let weatherResults = [];
    
    for (let i = 0; i < localidades.length; i += CHUNK_SIZE) {
      const chunk = localidades.slice(i, i + CHUNK_SIZE);
      const lats = chunk.map(loc => loc.lat).join(',');
      const lons = chunk.map(loc => loc.lon).join(',');
      
      const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&timezone=America/Argentina/Buenos_Aires`;
      
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      
      // Open-Meteo devuelve un array cuando hay múltiples coordenadas
      const dataArray = Array.isArray(data) ? data : [data];
      
      chunk.forEach((loc, index) => {
        const currentData = dataArray[index].current;
        weatherResults.push({
          id: loc.id,
          nombre: loc.n,
          provincia: loc.p,
          temp: currentData.temperature_2m,
          st: currentData.apparent_temperature,
          hum: currentData.relative_humidity_2m,
          viento: currentData.wind_speed_10m,
          lluvia: currentData.precipitation,
          codigo: currentData.weather_code
        });
      });
    }

    const finalOutput = {
      ultimaActualizacion: new Date().toISOString(),
      clima: weatherResults
    };

    fs.writeFileSync('clima-argentina.json', JSON.stringify(finalOutput));
    console.log(`Clima actualizado correctamente para ${weatherResults.length} localidades.`);

  } catch (error) {
    console.error('Error actualizando el clima:', error);
    process.exit(1);
  }
}

updateWeather();
