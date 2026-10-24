import mongoose from 'mongoose';

export async function connectDatabase() {
  try {
    // Plafond de connexions : Atlas M0 est limite a 500 connexions pour tout le
    // cluster, partagees avec les autres projets. Sans ces options le driver
    // monte a 100 par noeud du replica set et ne referme jamais les idle.
    await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      minPoolSize: 0,
      maxIdleTimeMS: 10000,
    });
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
}

mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB disconnected');
});

mongoose.connection.on('error', (error) => {
  console.error('❌ MongoDB error:', error);
});
