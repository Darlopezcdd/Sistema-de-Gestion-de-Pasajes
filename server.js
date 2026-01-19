const express = require('express');
const cors = require('cors');
const db = require('./db');
const oracledb = require('oracledb');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));


app.get('/api/routes', async (req, res) => {
    try {
        const result = await db.execute('SELECT * FROM RUTAS WHERE ESTADO = \'A\' ORDER BY ID_RUTA ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/routes', async (req, res) => {
    const { nombre_ruta, origen, destino, distancia_km, precio_base } = req.body;
    const sql = `INSERT INTO RUTAS (NOMBRE_RUTA, ORIGEN, DESTINO, DISTANCIA_KM, PRECIO_BASE) VALUES (:nombre_ruta, :origen, :destino, :distancia_km, :precio_base)`;
    try {
        await db.execute(sql, { nombre_ruta, origen, destino, distancia_km, precio_base });
        res.status(201).json({ message: 'Ruta creada exitosamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/routes/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre_ruta, origen, destino, distancia_km, precio_base } = req.body;
    const sql = `UPDATE RUTAS SET NOMBRE_RUTA = :nombre_ruta, ORIGEN = :origen, DESTINO = :destino, DISTANCIA_KM = :distancia_km, PRECIO_BASE = :precio_base WHERE ID_RUTA = :id`;
    try {
        await db.execute(sql, { id, nombre_ruta, origen, destino, distancia_km, precio_base });
        res.json({ message: 'Ruta actualizada exitosamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/routes/:id', async (req, res) => {
    const { id } = req.params;
    // Soft delete
    const sql = `UPDATE RUTAS SET ESTADO = 'I' WHERE ID_RUTA = :id`;
    try {
        await db.execute(sql, { id });
        res.json({ message: 'Ruta eliminada exitosamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


app.get('/api/units', async (req, res) => {
    try {
        const result = await db.execute('SELECT * FROM UNIDADES WHERE ESTADO = \'A\'');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


app.get('/api/types', async (req, res) => {
    try {
        const result = await db.execute('SELECT * FROM TIPOS_PASAJE');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



app.get('/api/tickets', async (req, res) => {
    const { routeId, dateFrom, dateTo } = req.query;
    
    let sql = `
        SELECT p.ID_PASAJE, 
               p.ID_RUTA, r.NOMBRE_RUTA,
               p.ID_UNIDAD, u.NOMBRE_UNIDAD,
               p.ID_TIPO, tp.DESCRIPCION as TIPO_PASAJE,
               p.VALOR, p.FECHA_VIAJE, p.CANTIDAD_ASIENTOS
        FROM PASAJES p
        JOIN RUTAS r ON p.ID_RUTA = r.ID_RUTA
        JOIN UNIDADES u ON p.ID_UNIDAD = u.ID_UNIDAD
        JOIN TIPOS_PASAJE tp ON p.ID_TIPO = tp.ID_TIPO
        WHERE 1=1
    `;
    
    const binds = {};
    
    if (routeId) {
        sql += ` AND p.ID_RUTA = :routeId`;
        binds.routeId = routeId;
    }
    

    if (dateFrom) {
        sql += ` AND p.FECHA_VIAJE >= TO_DATE(:dateFrom, 'YYYY-MM-DD')`;
        binds.dateFrom = dateFrom;
    }
    
    if (dateTo) {
        sql += ` AND p.FECHA_VIAJE <= TO_DATE(:dateTo, 'YYYY-MM-DD') + 1`; 
        binds.dateTo = dateTo;
    }

    sql += ` ORDER BY p.FECHA_VIAJE DESC`;

    try {
        const result = await db.execute(sql, binds);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


app.post('/api/tickets', async (req, res) => {
    const { id_ruta, id_unidad, id_tipo, fecha_viaje, cantidad_asientos } = req.body; // Removed manual valor
    
    try {
        // 1. Get Route Price
        const routeRes = await db.execute('SELECT PRECIO_BASE FROM RUTAS WHERE ID_RUTA = :id', { id: id_ruta });
        if (routeRes.rows.length === 0) throw new Error('Ruta no encontrada');
        const precioBase = routeRes.rows[0].PRECIO_BASE;

        // 2. Get Discount
        const typeRes = await db.execute('SELECT PORCENTAJE_DESCUENTO FROM TIPOS_PASAJE WHERE ID_TIPO = :id', { id: id_tipo });
        if (typeRes.rows.length === 0) throw new Error('Tipo de pasaje no encontrado');
        const descuento = typeRes.rows[0].PORCENTAJE_DESCUENTO;

        // 3. Calculate Total
        const total = (precioBase * cantidad_asientos) * (1 - descuento / 100);

        const sql = `
            INSERT INTO PASAJES (ID_RUTA, ID_UNIDAD, ID_TIPO, FECHA_VIAJE, CANTIDAD_ASIENTOS, VALOR)
            VALUES (:id_ruta, :id_unidad, :id_tipo, TO_DATE(:fecha_viaje, 'YYYY-MM-DD"T"HH24:MI'), :cantidad_asientos, :valor)
        `;
    
        await db.execute(sql, {
            id_ruta, id_unidad, id_tipo, fecha_viaje, 
            cantidad_asientos: cantidad_asientos || 1, 
            valor: total
        });
        res.status(201).json({ message: 'Ticket created successfully', total }); // Return total for confirmation if needed
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


app.delete('/api/tickets/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.execute(`DELETE FROM PASAJES WHERE ID_PASAJE = :id`, { id });
        res.json({ message: 'Ticket deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


app.get('/api/export', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection({
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            connectString: process.env.DB_CONNECTION_STRING
        });

        const sql = `BEGIN GENERAR_REPORTE_CSV(:output); END;`;
        
        const result = await connection.execute(sql, {
            output: { type: oracledb.CLOB, dir: oracledb.BIND_OUT }
        });

        const clob = result.outBinds.output;

        if (!clob) {
            await connection.close(); 
            return res.status(500).send("Error generando CSV desde PL/SQL");
        }

        res.header('Content-Type', 'text/csv');
        res.attachment('reporte_pasajes_plsql.csv');

        
        
        clob.setEncoding('utf8');
        
        clob.on('error', async (err) => {
            console.error("Error en flujo CLOB:", err);
            try { await connection.close(); } catch(e) {} 
            if (!res.headersSent) res.status(500).send("Error leyendo datos");
        });

        clob.on('end', async () => {
            try { await connection.close(); } catch(e) {} 
            res.end();
        });
        clob.pipe(res);

    } catch (err) {
        console.error(err);
        if (connection) {
            try { await connection.close(); } catch(e) {} 
        }
        res.status(500).send(err.message);
    }
});

app.put('/api/tickets/:id', async (req, res) => {
    const { id } = req.params;
    const { id_ruta, id_unidad, id_tipo, fecha_viaje, valor } = req.body;
    
    const sql = `
        UPDATE PASAJES 
        SET ID_RUTA = :id_ruta,
            ID_UNIDAD = :id_unidad,
            ID_TIPO = :id_tipo,
            FECHA_VIAJE = TO_DATE(:fecha_viaje, 'YYYY-MM-DD"T"HH24:MI'),
            VALOR = :valor
        WHERE ID_PASAJE = :id
    `;
    
    try {
        await db.execute(sql, {
            id, id_ruta, id_unidad, id_tipo, fecha_viaje, valor
        });
        res.json({ message: 'Pasaje actualizado correctamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

async function start() {
    try {
        await db.initialize();
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

start();
