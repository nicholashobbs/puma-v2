// /srv/puma/v2/frontend/src/App.jsx
import React, { useEffect, useState } from 'react'

export default function App() {
  const [ping, setPing] = useState('')
  const [items, setItems] = useState([])

  useEffect(() => {
    fetch('/api/ping').then(r => r.json()).then(d => setPing(d.status))
    fetch('/api/items').then(r => r.json()).then(setItems)
  }, [])

  async function addItem() {
    const name = prompt('Item name?')
    if (!name) return
    await fetch('/api/items', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ name })
    })
    const list = await fetch('/api/items').then(r => r.json())
    setItems(list)
  }

  return (
    <div style={{maxWidth: 640, margin: '4rem auto', fontFamily: 'system-ui'}}>
      <h1>Puma v2</h1>
      <p>API ping: <strong>{ping || '...'}</strong></p>
      <button onClick={addItem}>Add item</button>
      <ul>{items.map(i => <li key={i.id}>{i.name}</li>)}</ul>
    </div>
  )
}
