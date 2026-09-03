// plugins/get_weather.js — آب‌وهوای فعلی و پیش‌بینی، با Open-Meteo (رایگان، بدون کلید).
// مناسب برای وصل شدن به پروژه‌ی «اوج» (owj-weather-site) در آینده.
module.exports = {
  name: 'get_weather',
  description: 'وضعیت آب‌وهوای فعلی و پیش‌بینی چند روز آینده را برای یک مختصات جغرافیایی (latitude/longitude) بگیر.',
  input_schema: {
    type: 'object',
    properties: {
      latitude: { type: 'number' },
      longitude: { type: 'number' },
    },
    required: ['latitude', 'longitude'],
  },
  permission: 'green',
  handler: async ({ latitude, longitude }) => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;
      const res = await fetch(url);
      const data = await res.json();
      return JSON.stringify(data);
    } catch (err) {
      return `خطا در گرفتن آب‌وهوا: ${err.message}`;
    }
  },
};
