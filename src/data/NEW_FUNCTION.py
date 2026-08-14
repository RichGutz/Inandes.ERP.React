def check_if_int_min_already_charged(proposal_id: str, fecha_desembolso: dt.date) -> bool:
    """
    Verifica si el interés mínimo ya fue cobrado en algún pago anterior.
    
    Retorna True si algún pago ocurrió antes del día 15 desde el desembolso.
    Esto indica que el Int.Min ya fue aplicado y no debe cobrarse nuevamente
    en cronogramas de refinanciación.
    
    Args:
        proposal_id: ID de la propuesta/factura
        fecha_desembolso: Fecha original de desembolso
        
    Returns:
        True si Int.Min ya fue cobrado, False en caso contrario
    """
    try:
        eventos = get_liquidacion_eventos(proposal_id)
        
        for evento in eventos:
            fecha_evento_str = evento.get('fecha_evento')
            if fecha_evento_str:
                # Parsear fecha del evento
                try:
                    if isinstance(fecha_evento_str, str):
                        fecha_evento = dt.datetime.fromisoformat(fecha_evento_str).date()
                    else:
                        fecha_evento = fecha_evento_str
                    
                    # Calcular días transcurridos desde desembolso
                    dias_transcurridos = (fecha_evento - fecha_desembolso).days
                    
                    # Si algún pago ocurrió antes del día 15, Int.Min ya fue cobrado
                    if dias_transcurridos < 15:
                        return True
                        
                except (ValueError, AttributeError) as e:
                    # Si hay error parseando fecha, continuar con siguiente evento
                    continue
        
        # No se encontró ningún pago antes del día 15
        return False
        
    except Exception as e:
        print(f"[ERROR en check_if_int_min_already_charged]: {e}")
        # En caso de error, asumir que NO se cobró (comportamiento conservador)
        return False
