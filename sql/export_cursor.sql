-- Script PL/SQL para Exportación de Datos 

CREATE OR REPLACE PROCEDURE GENERAR_REPORTE_CSV(p_csv_output OUT CLOB) IS

    CURSOR c_reporte IS
        SELECT 
            r.NOMBRE_RUTA,
            tp.DESCRIPCION as TIPO_PASAJE,
            p.VALOR,
            TO_CHAR(p.FECHA_VIAJE, 'YYYY-MM-DD') as FECHA,
            TO_CHAR(p.FECHA_VIAJE, 'HH24:MI:SS') as HORA
        FROM PASAJES p
        JOIN RUTAS r ON p.ID_RUTA = r.ID_RUTA
        JOIN TIPOS_PASAJE tp ON p.ID_TIPO = tp.ID_TIPO
        ORDER BY p.FECHA_VIAJE DESC;

    v_ruta      RUTAS.NOMBRE_RUTA%TYPE;
    v_tipo      TIPOS_PASAJE.DESCRIPCION%TYPE;
    v_valor     PASAJES.VALOR%TYPE;
    v_fecha     VARCHAR2(20);
    v_hora      VARCHAR2(20);
    

    v_buffer    CLOB;
BEGIN

    v_buffer := 'Ruta,TipoPasaje,Valor,Fecha,Hora' || CHR(10);
    
    OPEN c_reporte;
    LOOP
        FETCH c_reporte INTO v_ruta, v_tipo, v_valor, v_fecha, v_hora;
        EXIT WHEN c_reporte%NOTFOUND;
        

        v_buffer := v_buffer || v_ruta || ',' || v_tipo || ',' || v_valor || ',' || v_fecha || ',' || v_hora || CHR(10);
        
    END LOOP;
    CLOSE c_reporte;
    

    p_csv_output := v_buffer;
EXCEPTION
    WHEN OTHERS THEN
        p_csv_output := 'Error: ' || SQLERRM;
        IF c_reporte%ISOPEN THEN CLOSE c_reporte; END IF;
END;
/
