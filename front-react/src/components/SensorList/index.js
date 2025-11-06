import styles from './SensorList.module.css';
import RequestButton from '../RequestButton';

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export default function SensorList({ sensores = [], onEdit, onDelete, useOriginalIndex = false, originalSensores = [] }) {
  return (
    <div className={styles.container}>
      {sensores.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyMessage}>Nenhum sensor cadastrado</div>
        </div>
      ) : (
        sensores.map((sensor, idx) => {
          // Converter buffer para base64 se existir
          let fotoUrl = '/images/logo.svg';
          if (sensor.foto_sensor && sensor.foto_sensor.data) {
            const base64String = arrayBufferToBase64(sensor.foto_sensor.data);
            fotoUrl = `data:image/jpeg;base64,${base64String}`;
          }
             // Determinar label do tipo do sensor sem exibir raw ObjectId
             const isObjectIdString = (v) => typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v);
             const tipoLabel = (typeof sensor.id_tipo_sensor === 'object')
               ? (sensor.id_tipo_sensor.descricao || sensor.id_tipo_sensor.nome || null)
               : (typeof sensor.id_tipo_sensor === 'string' ? (isObjectIdString(sensor.id_tipo_sensor) ? null : sensor.id_tipo_sensor) : null);
          return (
            <div className={styles.sensorCard} key={sensor._id || idx}>
              <div className={styles.gradientBar} />
              <div className={styles.icon}>
                <img src={fotoUrl} alt={sensor.id_tipo_sensor} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              </div>
              <div className={styles.info}>
                <div style={{ display: 'flex', flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                     {tipoLabel ? (
                       <>
                         <span className={styles.nome}>{tipoLabel}</span>
                         <span style={{ color: '#888', fontSize: '0.98rem', fontWeight: 500 }}>|</span>
                         <span className={styles.apelido}>{sensor.apelido || '-'}</span>
                       </>
                     ) : (
                       // Se não temos label de tipo (por ex. só temos ObjectId), mostrar apenas o apelido
                       <span className={styles.nome}>{sensor.apelido || 'Sensor'}</span>
                     )}
                </div>
                <div className={styles.numero}>
                  {`#${String(useOriginalIndex && originalSensores.length > 0 
                    ? originalSensores.findIndex(s => s._id === sensor._id) + 1 
                    : idx + 1).padStart(3, '0')}`}
                </div>
              </div>
              {!!onEdit || !!onDelete ? (
                <div className={styles.actions}>
                  {onEdit && (
                    <RequestButton 
                      className={`${styles.actionBtn} ${styles.edit}`} 
                      labelWhenAllowed=""
                      labelWhenRequest=""
                      action="editar_sensor"
                      payload={{ sensorId: sensor._id }}
                      onSuccess={() => onEdit && onEdit(sensor._id)}
                      title="Editar sensor"
                    >
                      <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </RequestButton>
                  )}
                  {onDelete && (
                    <RequestButton 
                      className={`${styles.actionBtn} ${styles.delete}`} 
                      labelWhenAllowed=""
                      labelWhenRequest=""
                      action="excluir_sensor"
                      payload={{ sensorId: sensor._id }}
                      onSuccess={() => onDelete && onDelete(sensor._id)}
                      title="Excluir sensor"
                    >
                      <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </RequestButton>
                  )}
                </div>
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );
} 