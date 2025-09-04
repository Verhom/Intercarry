import React, { useEffect, useMemo, useState } from "react";
// Mockup App – Flujo de Aprobación de Importaciones (mejoras)
// - Reglas de flujo (COMEX → QF con documentos mínimos)
// - Permisos por rol + botones contextuales
// - Persistencia en localStorage
// - Validaciones y mensajes de error
// - Toasts de notificación
// - SLA con semáforos (por etapa)
// - Filtros/orden en bandeja
// - Registro de recepción (Arribo y Recepción) y requisito para Liberación QF
// - Export JSON del expediente

// =============== Helpers ===============
const cls = (...xs) => xs.filter(Boolean).join(" ");
const prettyDate = (iso) => new Date(iso).toLocaleDateString();
const now = () => Date.now();
const HOURS = (h) => h * 60 * 60 * 1000;

// Documentos requeridos para pasar de Revisión COMEX a Revisión QF
const REQ_DOCS_QF = ["factura", "packing", "bl", "msds"];
const docOk = (st) => st && (st.status === "subido" || st.status === "aprobado");
const missingForQF = (expediente) => REQ_DOCS_QF.filter((id) => !docOk(expediente.docs[id]));

// Estados del flujo
const FLOW = [
  "Pre‑Alerta",
  "Revisión COMEX",
  "Revisión QF",
  "Programación Ingreso",
  "Arribo y Recepción",
  "Liberación QF",
  "Cerrado",
];

const ROLES = ["COMEX", "Operaciones", "QF"];

// =============== Toasts ===============
function useToasts() {
  const [toasts, setToasts] = useState([]);
  const push = (msg, type = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  };
  return { toasts, push };
}
function Toasts({ toasts }) {
  const color = (t) =>
    t.type === "error"
      ? "bg-red-600"
      : t.type === "success"
      ? "bg-emerald-600"
      : "bg-gray-900";
  return (
    <div className="fixed top-4 right-4 space-y-2 z-50">
      {toasts.map((t) => (
        <div key={t.id} className={cls("text-white px-3 py-2 rounded-lg shadow", color(t))}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// =============== Persistencia ===============
function usePersistentState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);
  return [value, setValue];
}

// =============== Datos Demo ===============
const MOCK = [
  {
    id: "IMP-24097",
    proveedor: "LabGen Pharma",
    bodegaDestino: "WeStorage",
    via: "Marítima",
    incoterm: "CIF",
    forwarder: "DHL GF",
    eta: "2025-09-21",
    rolPendiente: "QF",
    flowIndex: 2, // Revisión QF
    slaHoras: 24,
    stageStart: now() - HOURS(2),
    productos: [
      { sku: "RX-202", nombre: "Paracetamol 500mg", registro: "ISP-1234", temp: "15‑25°C" },
    ],
    docs: {
      factura: { status: "aprobado" },
      packing: { status: "aprobado" },
      bl: { status: "subido" },
      msds: { status: "aprobado" },
      registro_isp: { status: "pendiente" },
      permiso_isp: { status: "pendiente" },
      coa: { status: "pendiente" },
      etiquetado: { status: "pendiente" },
    },
    recepcion: [],
    historial: [
      { t: now() - HOURS(26), a: "COMEX", m: "Pre‑Alerta creada" },
      { t: now() - HOURS(20), a: "COMEX", m: "Documentos base revisados" },
      { t: now() - HOURS(2), a: "Sistema", m: "Enviado a Revisión QF" },
    ],
  },
  {
    id: "IMP-24122",
    proveedor: "Farmacorp",
    bodegaDestino: "Loginsa",
    via: "Aérea",
    incoterm: "DAP",
    forwarder: "K+N",
    eta: "2025-08-30",
    rolPendiente: "COMEX",
    flowIndex: 1,
    slaHoras: 8,
    stageStart: now() - HOURS(6),
    productos: [
      { sku: "COS-88", nombre: "Crema Facial 50ml", registro: "Cosmético Notificado", temp: "Ambiente" },
    ],
    docs: {
      factura: { status: "subido" },
      packing: { status: "pendiente" },
      bl: { status: "pendiente" },
      msds: { status: "pendiente" },
      cert_origen: { status: "pendiente" },
    },
    recepcion: [],
    historial: [{ t: now() - HOURS(6), a: "COMEX", m: "Revisión pendiente" }],
  },
  {
    id: "IMP-24160",
    proveedor: "BioHealth EU",
    bodegaDestino: "Concon",
    via: "Marítima",
    incoterm: "FOB",
    forwarder: "DB Schenker",
    eta: "2025-10-05",
    rolPendiente: "Operaciones",
    flowIndex: 3, // Programación Ingreso
    slaHoras: 12,
    stageStart: now() - HOURS(4),
    productos: [
      { sku: "BIO-71", nombre: "Reactivos laboratorio", registro: "ISP-5678", temp: "2‑8°C" },
    ],
    docs: {
      factura: { status: "aprobado" },
      packing: { status: "aprobado" },
      bl: { status: "aprobado" },
      msds: { status: "aprobado" },
      registro_isp: { status: "aprobado" },
    },
    recepcion: [],
    historial: [{ t: now() - HOURS(40), a: "QF", m: "Aprobación regulatoria OK" }],
  },
];

// =============== UI Pieces ===============
function Header({ role, setRole }) {
  return (
    <div className="flex items-center justify-between p-4 border-b bg-white sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🚢</span>
        <h1 className="text-xl font-semibold">Flujo de Aprobación de Importaciones</h1>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-500">Ver como:</label>
        <select
          className="px-3 py-2 border rounded-lg text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function StatusPill({ estado }) {
  const map = {
    "Pre‑Alerta": "bg-gray-100 text-gray-700",
    "Revisión COMEX": "bg-blue-100 text-blue-700",
    "Revisión QF": "bg-indigo-100 text-indigo-700",
    "Programación Ingreso": "bg-amber-100 text-amber-700",
    "Arribo y Recepción": "bg-emerald-100 text-emerald-700",
    "Liberación QF": "bg-teal-100 text-teal-700",
    Cerrado: "bg-gray-200 text-gray-700",
  };
  return (
    <span className={cls("px-2 py-1 text-xs font-semibold rounded-full", map[estado] || "bg-gray-100")}>{
      estado
    }</span>
  );
}

function Timeline({ index }) {
  return (
    <ol className="flex items-center gap-2">
      {FLOW.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span
            className={cls(
              "w-6 h-6 rounded-full grid place-content-center text-xs font-bold",
              i < index ? "bg-emerald-500 text-white" : i === index ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
            )}
            title={s}
          >
            {i + 1}
          </span>
          {i < FLOW.length - 1 && <span className="w-8 h-[2px] bg-gray-200" />}
        </li>
      ))}
    </ol>
  );
}

function ProgressBar({ value }) {
  return (
    <div className="w-full bg-gray-100 rounded h-2">
      <div className="bg-blue-600 h-2 rounded" style={{ width: `${value}%` }} />
    </div>
  );
}

function DocumentChecklist({ expediente, onToggle, role }) {
  const DOCS = [
    { id: "factura", nombre: "Factura Comercial", rol: "COMEX", obligatorio: true },
    { id: "packing", nombre: "Packing List", rol: "COMEX", obligatorio: true },
    { id: "bl", nombre: "BL / AWB", rol: "COMEX", obligatorio: true },
    { id: "cert_origen", nombre: "Cert. de Origen", rol: "COMEX", obligatorio: false },
    { id: "msds", nombre: "FDS / MSDS", rol: "COMEX", obligatorio: true },
    { id: "registro_isp", nombre: "Registro Sanitario ISP (si aplica)", rol: "QF", obligatorio: false },
    { id: "permiso_isp", nombre: "Permiso/Resolución ISP (PUI) (si aplica)", rol: "QF", obligatorio: false },
    { id: "coa", nombre: "Certificado de Análisis (CoA)", rol: "QF", obligatorio: false },
    { id: "etiquetado", nombre: "Rótulos/Etiquetado aprobado", rol: "QF", obligatorio: false },
  ];
  return (
    <div className="space-y-2">
      {DOCS.map((d) => {
        const st = expediente.docs[d.id]?.status || "pendiente";
        const canEdit = (role === d.rol) || (role === "COMEX" && d.rol === "COMEX") || (role === "QF" && d.rol === "QF");
        const esReq = REQ_DOCS_QF.includes(d.id);
        return (
          <div key={d.id} className="flex items-center justify-between border rounded-lg p-2">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={st === "aprobado" || st === "subido"}
                disabled={!canEdit}
                onChange={() => onToggle(d.id)}
                title={canEdit ? "Cicla: pendiente → subido → aprobado" : "Solo el responsable puede editar"}
              />
              <div>
                <div className="text-sm font-medium">{d.nombre}{esReq && <span className="ml-1 text-amber-600">*</span>}</div>
                <div className="text-xs text-gray-500">Responsable: {d.rol}{d.obligatorio ? " • Obligatorio" : ""}</div>
              </div>
            </div>
            <span
              className={cls(
                "text-xs font-semibold px-2 py-1 rounded-full",
                st === "aprobado" && "bg-emerald-100 text-emerald-700",
                st === "subido" && "bg-amber-100 text-amber-700",
                st === "pendiente" && "bg-gray-100 text-gray-600"
              )}
            >
              {st}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Historial({ expediente }) {
  return (
    <div className="space-y-2 max-h-80 overflow-auto pr-1">
      {expediente.historial.map((h, i) => (
        <div key={i} className="text-sm border rounded-lg p-2 bg-white">
          <div className="flex items-center justify-between">
            <div className="font-medium">{h.a}</div>
            <div className="text-xs text-gray-500">{new Date(h.t).toLocaleString()}</div>
          </div>
          <div className="text-gray-700">{h.m}</div>
        </div>
      ))}
    </div>
  );
}

function slaInfo(expediente) {
  const start = expediente.stageStart || expediente.historial?.[0]?.t || now();
  const deadline = start + HOURS(expediente.slaHoras || 24);
  const leftMs = deadline - now();
  const leftH = leftMs / 3600000;
  let tone = "";
  if (leftH <= 0) tone = "bg-red-100 text-red-700";
  else if (leftH <= 6) tone = "bg-amber-100 text-amber-700";
  else tone = "bg-emerald-100 text-emerald-700";
  return { leftH, tone };
}

function ExpedienteCard({ e, selected, onClick }) {
  const estado = FLOW[e.flowIndex];
  const { leftH, tone } = slaInfo(e);
  const criticidad = e.slaHoras <= 12 ? "border-amber-400" : "border-gray-200";
  return (
    <button
      onClick={onClick}
      className={cls(
        "w-full text-left bg-white border rounded-xl p-3 hover:shadow transition",
        selected ? "ring-2 ring-blue-500" : "",
        criticidad
      )}
    >
      <div className="flex items-center justify-between">
        <div className="font-semibold">{e.id} · {e.proveedor}</div>
        <div className="flex items-center gap-2">
          <StatusPill estado={estado} />
          <span className={cls("px-2 py-1 text-xs rounded-full", tone)} title="Horas restantes SLA">
            {Math.max(0, Math.round(leftH))}h SLA
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
        <div>Bodega destino: <span className="font-medium text-gray-800">{e.bodegaDestino}</span></div>
        <div>Vía: <span className="font-medium text-gray-800">{e.via}</span></div>
        <div>ETA: <span className="font-medium text-gray-800">{prettyDate(e.eta)}</span></div>
        <div>Pendiente en: <span className="font-medium text-gray-800">{e.rolPendiente}</span></div>
      </div>
    </button>
  );
}

function WorklistControls({ estadoFilter, setEstadoFilter, sort, setSort }) {
  return (
    <div className="flex flex-wrap gap-2 mb-2">
      <select className="px-2 py-1 border rounded text-xs" value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)}>
        <option>Todos</option>
        {FLOW.map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>
      <select className="px-2 py-1 border rounded text-xs" value={sort} onChange={(e) => setSort(e.target.value)}>
        <option value="eta_asc">ETA ↑</option>
        <option value="eta_desc">ETA ↓</option>
        <option value="sla_asc">SLA restante ↑</option>
        <option value="sla_desc">SLA restante ↓</option>
      </select>
    </div>
  );
}

function Worklist({ data, selectedId, setSelectedId }) {
  return (
    <div className="space-y-2">
      {data.map((e) => (
        <ExpedienteCard key={e.id} e={e} selected={selectedId === e.id} onClick={() => setSelectedId(e.id)} />
      ))}
    </div>
  );
}

function Resumen({ expediente }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="border rounded-xl p-4 bg-white">
        <div className="font-semibold mb-3">Información General</div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-gray-500">Proveedor:</span> {expediente.proveedor}</div>
          <div><span className="text-gray-500">Bodega destino: </span> {expediente.bodegaDestino}</div>
          <div><span className="text-gray-500">Vía:</span> {expediente.via}</div>
          <div><span className="text-gray-500">Incoterm:</span> {expediente.incoterm}</div>
          <div><span className="text-gray-500">Forwarder:</span> {expediente.forwarder}</div>
          <div><span className="text-gray-500">ETA:</span> {prettyDate(expediente.eta)}</div>
        </div>
        <div className="mt-4">
          <div className="text-sm text-gray-500 mb-2">Flujo</div>
          <Timeline index={expediente.flowIndex} />
        </div>
      </div>
      <div className="border rounded-xl p-4 bg-white">
        <div className="font-semibold mb-3">Productos</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-1">SKU</th>
              <th>Descripción</th>
              <th>Registro</th>
              <th>Condición</th>
            </tr>
          </thead>
          <tbody>
            {expediente.productos.map((p, i) => (
              <tr key={i} className="border-t">
                <td className="py-1">{p.sku}</td>
                <td>{p.nombre}</td>
                <td>{p.registro}</td>
                <td>{p.temp}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 text-xs text-gray-500">* FEFO, lote y vencimiento se capturan en la recepción y quedan disponibles para liberación QF.</div>
      </div>
    </div>
  );
}

function RecepcionForm({ onAdd }) {
  const [lote, setLote] = useState("");
  const [vto, setVto] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [frio, setFrio] = useState(false);
  const [tempOk, setTempOk] = useState(true);
  const submit = () => {
    if (!lote || !vto || !cantidad) return onAdd(null, "Completa lote, vencimiento y cantidad");
    onAdd({ lote, vencimiento: vto, cantidad: Number(cantidad), cadenaFrio: frio, tempOk });
    setLote("");
    setVto("");
    setCantidad("");
    setFrio(false);
    setTempOk(true);
  };
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input className="border rounded px-2 py-1 text-sm" placeholder="Lote" value={lote} onChange={(e) => setLote(e.target.value)} />
        <input className="border rounded px-2 py-1 text-sm" placeholder="Vencimiento (YYYY-MM)" value={vto} onChange={(e) => setVto(e.target.value)} />
        <input className="border rounded px-2 py-1 text-sm" placeholder="Cantidad" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
        <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={frio} onChange={(e) => setFrio(e.target.checked)} /> Cadena de frío</label>
        <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={tempOk} onChange={(e) => setTempOk(e.target.checked)} /> Temperatura OK</label>
      </div>
      <button onClick={submit} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm w-full">Registrar recepción</button>
    </div>
  );
}

function ApprovalsPanel({ expediente, setExpediente, role, notify }) {
  const [comment, setComment] = useState("");

  const estadoActual = FLOW[expediente.flowIndex];
  const pct = Math.round(((expediente.flowIndex + 1) / FLOW.length) * 100);

  const log = (m, a = role) => ({ t: now(), a, m });
  const upd = (next) => {
    if (comment) next.historial = [log(`Nota: ${comment}`, "Comentario"), ...next.historial];
    setComment("");
    setExpediente(next);
  };

  const sendToQF = () => {
    const missing = missingForQF(expediente);
    if (missing.length) return notify(`Faltan documentos para enviar a QF: ${missing.join(", ")}`, "error");
    const next = { ...expediente };
    next.historial = [log("Enviado a Revisión QF", "Sistema"), ...next.historial];
    next.flowIndex = 2; // Revisión QF
    next.rolPendiente = "QF";
    next.stageStart = now();
    upd(next);
    notify("Expediente enviado a QF", "success");
  };

  const approveQF = () => {
    const next = { ...expediente };
    next.historial = [log("QF aprueba regulatoriamente"), ...next.historial];
    next.flowIndex = 3; // Programación Ingreso
    next.rolPendiente = "Operaciones";
    next.stageStart = now();
    upd(next);
    notify("Aprobado por QF", "success");
  };

  const observeQF = () => {
    const next = { ...expediente };
    next.historial = [log("QF solicita ajustes/registros adicionales"), ...next.historial];
    next.rolPendiente = "COMEX";
    upd(next);
    notify("Observado y devuelto a COMEX", "info");
  };

  const programarIngreso = () => {
    const next = { ...expediente };
    next.historial = [log("Operaciones agenda ingreso en CD"), ...next.historial];
    next.flowIndex = 4; // Arribo y Recepción
    next.rolPendiente = "Operaciones";
    next.stageStart = now();
    upd(next);
    notify("Ingreso programado", "success");
  };

  const agregarRecepcion = (rec, err) => {
    if (!rec) return notify(err || "Datos incompletos", "error");
    const next = { ...expediente };
    next.recepcion = [...(next.recepcion || []), rec];
    next.historial = [log(`Recepción registrada: lote ${rec.lote}`), ...next.historial];
    upd(next);
    notify("Recepción registrada", "success");
  };

  const liberarFinal = () => {
    if (!expediente.recepcion || expediente.recepcion.length === 0)
      return notify("Debe existir al menos una recepción registrada para liberar.", "error");
    const next = { ...expediente };
    next.historial = [log("QF libera lote(s) tras control documental"), ...next.historial];
    next.flowIndex = 6; // Cerrado
    next.rolPendiente = "—";
    next.stageStart = now();
    upd(next);
    notify("Expediente cerrado", "success");
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(expediente, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${expediente.id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm text-gray-500 mb-1">Avance</div>
        <ProgressBar value={pct} />
      </div>

      {/* Botones contextuales por etapa/rol */}
      <div className="flex flex-wrap gap-2">
        {role === "COMEX" && estadoActual === "Revisión COMEX" && (
          <button onClick={sendToQF} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm">📤 Enviar a QF</button>
        )}
        {role === "QF" && estadoActual === "Revisión QF" && (
          <>
            <button onClick={approveQF} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm">✔️ Aprobar QF</button>
            <button onClick={observeQF} className="px-3 py-2 rounded-lg bg-amber-600 text-white text-sm">📝 Observar / Pedir cambios</button>
          </>
        )}
        {role === "Operaciones" && estadoActual === "Programación Ingreso" && (
          <button onClick={programarIngreso} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm">📅 Programar Ingreso</button>
        )}
        {role === "QF" && estadoActual === "Arribo y Recepción" && (
          <button onClick={liberarFinal} className="px-3 py-2 rounded-lg bg-teal-700 text-white text-sm">🟢 Liberación Final</button>
        )}
        <button onClick={exportJSON} className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm ml-auto">⬇️ Exportar JSON</button>
      </div>

      {/* Comentarios */}
      <div className="space-y-2">
        <textarea
          placeholder="Agrega una nota o comentario visible en el expediente"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full p-2 border rounded-lg text-sm min-h-[80px]"
        />
        <div className="text-xs text-gray-500">Consejo: usa @COMEX, @QF o @Operaciones para notificar a un rol.</div>
      </div>

      {/* Registro de recepción */}
      {role === "Operaciones" && estadoActual === "Arribo y Recepción" && (
        <div className="space-y-2">
          <div className="text-sm font-semibold">Recepción</div>
          <RecepcionForm onAdd={agregarRecepcion} />
          {expediente.recepcion && expediente.recepcion.length > 0 && (
            <div className="text-xs text-gray-600">Recepciones: {expediente.recepcion.map((r) => r.lote).join(", ")}</div>
          )}
        </div>
      )}

      {/* Validaciones visibles */}
      {estadoActual === "Revisión COMEX" && (
        <div className="text-xs">
          <span className="font-semibold">Faltantes para enviar a QF: </span>
          {missingForQF(expediente).length ? (
            <span className="text-amber-700">{missingForQF(expediente).join(", ")}</span>
          ) : (
            <span className="text-emerald-700">Ninguno</span>
          )}
        </div>
      )}
    </div>
  );
}

function Detalle({ expediente, setExpediente, role, notify }) {
  const estado = FLOW[expediente.flowIndex];

  const toggleDoc = (id) => {
    const cur = expediente.docs[id]?.status || "pendiente";
    const nextStatus = cur === "pendiente" ? "subido" : cur === "subido" ? "aprobado" : "pendiente";
    const next = { ...expediente, docs: { ...expediente.docs, [id]: { status: nextStatus } } };
    setExpediente(next);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="border rounded-xl p-4 bg-white">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm text-gray-500">Estado actual</div>
                <div className="text-lg font-semibold">{estado}</div>
              </div>
              <StatusPill estado={estado} />
            </div>
            <Resumen expediente={expediente} />
          </div>
          <div className="border rounded-xl p-4 bg-white">
            <div className="font-semibold mb-3">Checklist Documental</div>
            <DocumentChecklist expediente={expediente} onToggle={toggleDoc} role={role} />
          </div>
          <div className="border rounded-xl p-4 bg-white">
            <div className="font-semibold mb-3">Historial</div>
            <Historial expediente={expediente} />
          </div>
        </div>
        <div className="space-y-4">
          <div className="border rounded-xl p-4 bg-white sticky top-20">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Acciones</div>
              <div className="text-xs px-2 py-1 rounded-full bg-gray-100">Rol: {role}</div>
            </div>
            <ApprovalsPanel expediente={expediente} setExpediente={setExpediente} role={role} notify={notify} />
          </div>
        </div>
      </div>
    </div>
  );
}

// =============== App ===============
export default function App() {
  const [role, setRole] = usePersistentState("fi_role", "COMEX");
  const [expedientes, setExpedientes] = usePersistentState("fi_expedientes_v1", MOCK);
  const [selectedId, setSelectedId] = useState(expedientes[0]?.id || "");
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("Todos");
  const [sort, setSort] = useState("eta_asc");
  const { toasts, push } = useToasts();

  const selected = useMemo(() => expedientes.find((e) => e.id === selectedId), [expedientes, selectedId]);

  const filteredSorted = useMemo(() => {
    const q = search.toLowerCase();
    let arr = expedientes.filter((e) =>
      [e.id, e.proveedor, e.bodegaDestino, e.via, e.forwarder].some((x) => String(x).toLowerCase().includes(q))
    );
    if (estadoFilter !== "Todos") arr = arr.filter((e) => FLOW[e.flowIndex] === estadoFilter);
    const asMs = (d) => new Date(d).getTime();
    const bySLA = (e) => slaInfo(e).leftH;
    arr.sort((a, b) => {
      if (sort === "eta_asc") return asMs(a.eta) - asMs(b.eta);
      if (sort === "eta_desc") return asMs(b.eta) - asMs(a.eta);
      if (sort === "sla_asc") return bySLA(a) - bySLA(b);
      if (sort === "sla_desc") return bySLA(b) - bySLA(a);
      return 0;
    });
    return arr;
  }, [expedientes, search, estadoFilter, sort]);

  const replaceSelected = (next) => setExpedientes((arr) => arr.map((e) => (e.id === next.id ? next : e)));

  const addPrealerta = () => {
    const nid = `IMP-${Math.floor(10000 + Math.random() * 89999)}`;
    const nuevo = {
      id: nid,
      proveedor: "Nuevo Proveedor",
      bodegaDestino: "—",
      via: "A definir",
      incoterm: "—",
      forwarder: "—",
      eta: new Date(Date.now() + HOURS(24 * 15)).toISOString(),
      rolPendiente: "COMEX",
      flowIndex: 0,
      slaHoras: 24,
      stageStart: now(),
      productos: [],
      docs: {},
      recepcion: [],
      historial: [{ t: now(), a: "COMEX", m: "Pre‑Alerta creada" }],
    };
    setExpedientes((arr) => [nuevo, ...arr]);
    setSelectedId(nid);
    push("Pre‑Alerta creada", "success");
  };

  const resetData = () => {
    setExpedientes(MOCK);
    setSelectedId(MOCK[0].id);
    push("Datos demo restablecidos", "info");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header role={role} setRole={setRole} />
      <Toasts toasts={toasts} />

      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-4 p-4">
        {/* Sidebar */}
        <aside className="space-y-3">
          <div className="border rounded-xl p-3 bg-white">
            <div className="text-sm font-semibold mb-2">Bandeja de Trabajo</div>
            <div className="flex gap-2 mb-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por ID, proveedor, bodega destino..."
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <button onClick={addPrealerta} className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm">＋ Nueva</button>
            </div>
            <WorklistControls estadoFilter={estadoFilter} setEstadoFilter={setEstadoFilter} sort={sort} setSort={setSort} />
            <div className="text-xs text-gray-500 mb-2">Mostrando {filteredSorted.length} expediente(s)</div>
            <Worklist data={filteredSorted} selectedId={selectedId} setSelectedId={setSelectedId} />
            <div className="pt-3 flex gap-2">
              <button onClick={resetData} className="px-2 py-1 rounded border text-xs">Restablecer demo</button>
            </div>
          </div>

          <div className="border rounded-xl p-3 bg-white">
            <div className="text-sm font-semibold mb-2">SLA (guía de referencia)</div>
            <ul className="text-xs space-y-1 text-gray-700">
              <li>COMEX: Revisión pre‑alerta ≤ 8h</li>
              <li>QF: Revisión regulatoria ≤ 24h</li>
              <li>Operaciones: Programar ingreso ≤ 24h</li>
              <li>Recepción controlada para cadena de frío cuando aplique</li>
            </ul>
          </div>

          <div className="border rounded-xl p-3 bg-white">
            <div className="text-sm font-semibold mb-2">Reglas de Negocio</div>
            <ul className="text-xs space-y-1 text-gray-700">
              <li>Para pasar a <b>Revisión QF</b> se requieren: Factura, Packing List, BL/AWB y FDS/MSDS al menos "subidos".</li>
              <li>La <b>Liberación QF</b> exige al menos una recepción registrada (lote, vencimiento, cantidad).</li>
              <li>Los botones de acción se muestran solo para el rol/etapa correspondiente.</li>
              <li>Los cambios se guardan en el navegador (localStorage).</li>
            </ul>
          </div>
        </aside>

        {/* Main */}
        <main className="space-y-4">
          {selected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-500">Expediente</div>
                  <div className="text-2xl font-bold">{selected.id}</div>
                </div>
                <div className="text-sm text-gray-600">Pendiente en: <span className="font-semibold">{selected.rolPendiente}</span></div>
              </div>
              <Detalle expediente={selected} setExpediente={replaceSelected} role={role} notify={push} />
            </div>
          ) : (
            <div className="text-gray-500">Selecciona un expediente…</div>
          )}
        </main>
      </div>

      <footer className="p-4 text-xs text-center text-gray-500">Mockup interactivo – InterCarry · COMEX · Operaciones · QF</footer>
    </div>
  );
}
