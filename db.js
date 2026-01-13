const oracledb = require('oracledb');
require('dotenv').config();


oracledb.autoCommit = true;

async function initialize() {
  await oracledb.createPool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECTION_STRING,
    poolMin: 2,
    poolMax: 10,
    poolIncrement: 2
  });
  console.log('Oracle Database Connection Pool Started');
}

async function close() {
  await oracledb.getPool().close(0);
  console.log('Oracle Database Connection Pool Closed');
}

async function execute(sql, binds = [], options = {}) {
  let connection;
  try {

    connection = await oracledb.getConnection();
    

    options.outFormat = oracledb.OUT_FORMAT_OBJECT;

    const result = await connection.execute(sql, binds, options);
    return result;
  } catch (err) {
    console.error('Database Error:', err);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
}

module.exports = {
  initialize,
  close,
  execute
};
