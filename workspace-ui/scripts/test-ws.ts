const ws = new WebSocket('wss://stream.bybit.com/v5/public/linear');
const timeout = setTimeout(() => { console.log('TIMEOUT'); ws.close(); process.exit(0); }, 20000);
const msgs: string[] = [];
ws.onopen = () => {
  console.log('WS OPEN');
  // First: send empty subscribe (like the adapter does in onopen)
  const empty = JSON.stringify({ op: 'subscribe', args: [] });
  console.log('SEND:', empty);
  ws.send(empty);
  // Then after a brief delay, send the real subscription
  setTimeout(() => {
    const real = JSON.stringify({ op: 'subscribe', args: ['kline.1.BTCUSDT'] });
    console.log('SEND:', real);
    ws.send(real);
  }, 500);
};
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  msgs.push(JSON.stringify(msg).slice(0,200));
  console.log('RECV:', msgs.length, msg.op || msg.topic || msg.type || '?');
  // After 3 messages, check if kline arrived
  if (msgs.length >= 5) {
    clearTimeout(timeout);
    ws.close();
    console.log('ALL:', msgs.join('\n'));
    process.exit(0);
  }
};
