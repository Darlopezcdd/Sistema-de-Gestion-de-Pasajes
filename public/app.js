
const API_URL = '/api';

let isEditing = false;
let editingId = null;

// Store data for calculations
let allRoutes = [];
let allTypes = [];
let allUnits = [];

document.addEventListener('DOMContentLoaded', () => {
    loadDropdowns();
    loadTickets();
    loadRoutesTable(); // Initial load
    
    // Add event listeners for calc
    document.getElementById('newRoute').addEventListener('change', calculateTotal);
    document.getElementById('newType').addEventListener('change', calculateTotal);
});

async function loadDropdowns() {
    try {
        const [routes, units, types] = await Promise.all([
            fetch(`${API_URL}/routes`).then(res => res.json()),
            fetch(`${API_URL}/units`).then(res => res.json()),
            fetch(`${API_URL}/types`).then(res => res.json())
        ]);

        allRoutes = routes;
        allUnits = units;
        allTypes = types;

        populateSelect('filterRoute', routes, 'ID_RUTA', 'NOMBRE_RUTA');
        populateSelect('newRoute', routes, 'ID_RUTA', 'NOMBRE_RUTA');
        populateSelect('newUnit', units, 'ID_UNIDAD', 'NOMBRE_UNIDAD'); 
        populateSelect('newType', types, 'ID_TIPO', 'DESCRIPCION');

    } catch (err) {
        console.error('Error loading dropdowns:', err);
    }
}

function populateSelect(elementId, data, valueKey, textKey) {
    const select = document.getElementById(elementId);
    // Keep first option (placeholder)
    const placeholder = select.firstElementChild;
    select.innerHTML = '';
    select.appendChild(placeholder);

    data.forEach(item => {
        const option = document.createElement('option');
        option.value = item[valueKey];
        option.textContent = item[textKey];
        select.appendChild(option);
    });
}

// --- View Management ---
function toggleView(view) {
    const routesSec = document.getElementById('routesSection');
    const ticketsSec = document.getElementById('ticketsSection');
    
    if (view === 'routes') {
        routesSec.style.display = 'block';
        ticketsSec.style.display = 'none';
        loadRoutesTable();
    } else {
        routesSec.style.display = 'none';
        ticketsSec.style.display = 'block';
        loadTickets();
    }
}

// --- Route Management ---
async function loadRoutesTable() {
    try {
        const res = await fetch(`${API_URL}/routes`);
        const routes = await res.json();
        allRoutes = routes; // Update global
        
        const tbody = document.getElementById('routesTableBody');
        tbody.innerHTML = '';
        
        routes.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${r.NOMBRE_RUTA}</td>
                <td>${r.ORIGEN}</td>
                <td>${r.DESTINO}</td>
                <td>${r.DISTANCIA_KM} km</td>
                <td>$${r.PRECIO_BASE.toFixed(2)}</td>
                <td>
                    <button class="btn-primary" onclick='editRoute(${JSON.stringify(r)})'>Editar</button>
                    <button class="btn-delete" onclick="deleteRoute(${r.ID_RUTA})">Eliminar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error(err);
    }
}

async function handleRouteSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('routeId').value;
    const data = {
        nombre_ruta: document.getElementById('routeName').value,
        origen: document.getElementById('routeOrigin').value,
        destino: document.getElementById('routeDest').value,
        distancia_km: document.getElementById('routeDist').value,
        precio_base: document.getElementById('routePrice').value
    };
    
    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/routes/${id}` : `${API_URL}/routes`;
    
    try {
        const res = await fetch(url, {
            method,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        if(res.ok) {
            alert('Ruta guardada');
            resetRouteForm();
            loadRoutesTable();
            loadDropdowns(); // Refresh dropdowns
        } else {
            alert('Error al guardar ruta');
        }
    } catch(err) { console.error(err); }
}

function editRoute(r) {
    document.getElementById('routeId').value = r.ID_RUTA;
    document.getElementById('routeName').value = r.NOMBRE_RUTA;
    document.getElementById('routeOrigin').value = r.ORIGEN;
    document.getElementById('routeDest').value = r.DESTINO;
    document.getElementById('routeDist').value = r.DISTANCIA_KM;
    document.getElementById('routePrice').value = r.PRECIO_BASE;
}

function resetRouteForm() {
    document.getElementById('routeForm').reset();
    document.getElementById('routeId').value = '';
}

async function deleteRoute(id) {
    if(!confirm('¿Eliminar ruta?')) return;
    try {
        await fetch(`${API_URL}/routes/${id}`, { method: 'DELETE' });
        loadRoutesTable();
        loadDropdowns();
    } catch(err) { console.error(err); }
}


// --- Ticket Management ---

async function loadTickets() {
    const routeId = document.getElementById('filterRoute').value;
    const dateFrom = document.getElementById('filterDateFrom').value;
    const dateTo = document.getElementById('filterDateTo').value;

    const params = new URLSearchParams();
    if (routeId) params.append('routeId', routeId);
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);

    try {
        const res = await fetch(`${API_URL}/tickets?${params}`);
        const tickets = await res.json();
        renderTable(tickets);
    } catch (err) {
        console.error('Error loading tickets:', err);
    }
}

function renderTable(tickets) {
    const tbody = document.getElementById('ticketTableBody');
    tbody.innerHTML = '';

    if (tickets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 2rem;">No hay registros encontrados</td></tr>';
        return;
    }

    tickets.forEach(t => {
        const ticketStr = encodeURIComponent(JSON.stringify(t));
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${t.NOMBRE_RUTA}</td>
            <td>${t.NOMBRE_UNIDAD}</td>
            <td><span class="badge">${t.TIPO_PASAJE}</span></td>
            <td>${new Date(t.FECHA_VIAJE).toLocaleString()}</td>
            <td>$${t.VALOR.toFixed(2)}</td>
            <td>
                <button class="btn-primary" onclick="loadTicketIntoForm('${ticketStr}')" style="margin-right:5px;">Editar</button>
                <button class="btn-delete" onclick="deleteTicket(${t.ID_PASAJE})">Eliminar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function calculateTotal() {
    const routeId = document.getElementById('newRoute').value;
    const typeId = document.getElementById('newType').value;
    const seats = parseInt(document.getElementById('newSeats').value) || 1;
    
    if (!routeId || !typeId) return;

    const route = allRoutes.find(r => r.ID_RUTA == routeId);
    const type = allTypes.find(t => t.ID_TIPO == typeId);

    if (route && type) {
        const price = route.PRECIO_BASE;
        const discount = type.PORCENTAJE_DESCUENTO;
        const total = (price * seats) * (1 - discount/100);
        
        document.getElementById('newValue').value = total.toFixed(2);
    }
}

function loadTicketIntoForm(ticketStr) {
    const t = JSON.parse(decodeURIComponent(ticketStr));
    
    isEditing = true;
    editingId = t.ID_PASAJE;

    document.getElementById('newRoute').value = t.ID_RUTA;
    document.getElementById('newUnit').value = t.ID_UNIDAD;
    document.getElementById('newType').value = t.ID_TIPO;
    
    // Check if CANTIDAD_ASIENTOS exists (handle legacy data)
    const seats = t.CANTIDAD_ASIENTOS || 1; 
    document.getElementById('newSeats').value = seats;
    
    document.getElementById('newValue').value = t.VALOR;

    const date = new Date(t.FECHA_VIAJE);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    document.getElementById('newDate').value = date.toISOString().slice(0, 16);

    const submitBtn = document.querySelector('#createTicketForm button[type="submit"]');
    submitBtn.textContent = "Actualizar Pasaje";
    submitBtn.style.backgroundColor = "#ec4899";
    
    calculateTotal(); // Recalculate to show correct
}

async function handleCreateTicket(e) {
    e.preventDefault();
    
    const data = {
        id_ruta: document.getElementById('newRoute').value,
        id_unidad: document.getElementById('newUnit').value,
        id_tipo: document.getElementById('newType').value,
        fecha_viaje: document.getElementById('newDate').value,
        cantidad_asientos: document.getElementById('newSeats').value,
        valor: document.getElementById('newValue').value 
    };

    try {
        let url = `${API_URL}/tickets`;
        let method = 'POST';

        if (isEditing) {
            url = `${API_URL}/tickets/${editingId}`;
            method = 'PUT';
        }

        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            alert(isEditing ? 'Actualizado correctamente' : 'Registrado correctamente');
            document.getElementById('createTicketForm').reset();
            // Reset seats
            document.getElementById('newSeats').value = 1;
            loadTickets();
            
            isEditing = false;
            editingId = null;
            document.querySelector('#createTicketForm button[type="submit"]').textContent = "Guardar Pasaje";
            document.querySelector('#createTicketForm button[type="submit"]').style.backgroundColor = "";
        } else {
            const err = await res.json();
            alert('Error: ' + err.error);
        }
    } catch (err) {
        console.error(err);
        alert('Error de conexión');
    }
}

async function deleteTicket(id) {
    if(!confirm('¿Está seguro de eliminar este registro?')) return;
    try {
        const res = await fetch(`${API_URL}/tickets/${id}`, { method: 'DELETE' });
        if (res.ok) {
            loadTickets();
        } else {
            alert('Error al eliminar');
        }
    } catch (err) {
        alert('Error de conexión');
    }
}

function exportCSV() {
    window.location.href = `${API_URL}/export`;
}

function resetFilters() {
    document.getElementById('filterRoute').value = '';
    document.getElementById('filterDateFrom').value = '';
    document.getElementById('filterDateTo').value = '';
    loadTickets();
}
