// 2. Llamar a la Edge Function Joyas (genera imagen + guarda en DB + envía emails)
		let aiResult = null;
		try {
			aiResult = await callEdgeFunction('Joyas', {
				nombre: state.name,
				telefono: state.phone,
				email: state.email,
				categoria_producto: state.category,
				material: state.material,
				perfil_usuario: state.profile,
				gema_principal: state.gemstone,
				estilo: state.style,
				presupuesto: state.budget,
				peso_estimado: state.weight,
				talla_medida: state.size,
				sugerencias: state.notes,
			});
		} catch (aiError) {
			console.warn('[Romet] Edge function call failed:', aiError);
			aiResult = { imagenUrl: null };
		}

		// 3. Mostrar pantalla de éxito
		showSuccessScreen(state, aiResult);
		clearState();
