import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const day = (value) => {
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date)
}

export default function WeatherForecastChart({ forecast = [] }) {
  const data = (Array.isArray(forecast) ? forecast : []).filter((item) => item && typeof item === 'object').map((item) => ({ ...item, day: day(item.date) }))
  return <div className="h-56 w-full" aria-label="Seven day village weather forecast chart">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 12, right: 12, left: -22, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
        <XAxis dataKey="day" tick={{ fontSize: 12 }} />
        <YAxis yAxisId="temperature" tick={{ fontSize: 11 }} unit="°" />
        <YAxis yAxisId="rain" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
        <Tooltip formatter={(value, name) => [name === 'Rain chance' ? `${value}%` : `${value}°C`, name]} />
        <Line yAxisId="temperature" type="monotone" dataKey="maxTemperature" name="Day high" stroke="#dc6b2f" strokeWidth={3} dot={{ r: 3 }} />
        <Line yAxisId="temperature" type="monotone" dataKey="minTemperature" name="Night low" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} />
        <Line yAxisId="rain" type="monotone" dataKey="rainProbability" name="Rain chance" stroke="#0891b2" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  </div>
}
