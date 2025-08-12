import mongoose from 'mongoose';
const dbCache = new Map();
export const initMongo = async (configs) => {
  const { schema, user, pass, host, options } = configs;
  const encodedUser = encodeURIComponent(user);
  const encodedPass = encodeURIComponent(pass);
  const uri = user
    ? `${schema}://${encodedUser}:${encodedPass}@${host}`
    : `${schema}://${host}`;
  
  // Add connection timeout and other options
  const mongoOptions = {
    ...options,
    serverSelectionTimeoutMS: 5000, // 5 second timeout
    connectTimeoutMS: 10000, // 10 second connection timeout
    socketTimeoutMS: 45000, // 45 second socket timeout
  };
  
  try {
    console.log('🔄 Attempting to connect to MongoDB...', uri.replace(/\/\/.*@/, '//***:***@'));
    await mongoose.connect(uri, mongoOptions);
    console.log('✅ MongoDB connected successfully');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    
    // For development, create a warning but don't crash
    console.warn('⚠️  Continuing without MongoDB connection for development...');
  }
};
export function getDbConnection(dbName) {
  if (dbCache.has(dbName)) {
    return dbCache.get(dbName);
  }
  //  dbLogger.connect(`Connecting to database: ${dbName}`);
  const db = mongoose.connection.useDb(dbName, { useCache: true });
  dbCache.set(dbName, db);
  return db;
}
