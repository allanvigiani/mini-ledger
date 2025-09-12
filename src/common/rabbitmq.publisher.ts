import * as amqp from 'amqplib';

export async function publishToQueue(queue: string, message: any) {
  try {
    const connection = await amqp.connect('amqp://guest:guest@rabbitmq:5672');
    const channel = await connection.createChannel();
    await channel.assertQueue(queue, { durable: true });
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
      persistent: true,
    });
    setTimeout(() => {
      channel
        .close()
        .then(() => connection.close())
        .catch((err) => {
          console.error('Erro ao fechar o canal RabbitMQ:', err);
          connection.close().catch((err) => {
            console.error('Erro ao fechar a conexão RabbitMQ:', err);
          });
        });
    }, 500);
  } catch (err) {
    console.error('Erro ao publicar no RabbitMQ:', err);
  }
}
