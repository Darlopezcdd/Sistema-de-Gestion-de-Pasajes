
const API_URL = '/api';

let isEditing = false;
let editingId = null;


document.addEventListener('DOMContentLoaded', () => {
    loadDropdowns();
    loadTickets();
});


async function loadDropdowns() {
    try {
        const [routes, units, types] = await Promise.all([
            fetch(`${API_URL}/routes`).then(res => res.json()),
            fetch(`${API_URL}/units`).then(res => res.json()),
            fetch(`${API_URL}/types`).then(res => res.json())
        ]);

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
    data.forEach(item => {
        const option = document.createElement('option');
        option.value = item[valueKey];
        option.textContent = item[textKey];
        if(elementId === 'newUnit') option.textContent = item[textKey]; 
        select.appendChild(option);
    });
}


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
        alert('Error al cargar pasajes');
    }
}

function renderTable(tickets) {
    const tbody = document.getElementById('ticketTableBody');
    tbody.innerHTML = '';

    if (tickets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;">No hay registros encontrados</td></tr>';
        return;
    }

    tickets.forEach(t => {
        // Convertimos el objeto a string para pasarlo a la función
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

// Load Ticket Into Form
function loadTicketIntoForm(ticketStr) {
    const t = JSON.parse(decodeURIComponent(ticketStr));
    
    isEditing = true;
    editingId = t.ID_PASAJE;

    // Rellenar campos
    document.getElementById('newRoute').value = t.ID_RUTA;
    document.getElementById('newUnit').value = t.ID_UNIDAD;
    document.getElementById('newType').value = t.ID_TIPO;
    document.getElementById('newValue').value = t.VALOR;

    // Ajustar fecha para el input datetime-local
    const date = new Date(t.FECHA_VIAJE);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    document.getElementById('newDate').value = date.toISOString().slice(0, 16);

    // Cambiar visualmente el botón
    const submitBtn = document.querySelector('#createTicketForm button[type="submit"]');
    submitBtn.textContent = "Actualizar Pasaje";
    submitBtn.style.backgroundColor = "#ec4899"; // Opcional: cambiar color
}

// Create Ticket
// Create or Update Ticket
async function handleCreateTicket(e) {
    e.preventDefault();
    
    const data = {
        id_ruta: document.getElementById('newRoute').value,
        id_unidad: document.getElementById('newUnit').value,
        id_tipo: document.getElementById('newType').value,
        fecha_viaje: document.getElementById('newDate').value,
        valor: document.getElementById('newValue').value
    };

    try {
        let url = `${API_URL}/tickets`;
        let method = 'POST';

        // LÓGICA AGREGADA PARA EDITAR
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
            loadTickets();
            
            // Resetear estados
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

// Delete Ticket
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

// Export CSV
function exportCSV() {
    window.location.href = `${API_URL}/export`;
}

function resetFilters() {
    document.getElementById('filterRoute').value = '';
    document.getElementById('filterDateFrom').value = '';
    document.getElementById('filterDateTo').value = '';
    loadTickets();
}
