// 2. Llamar a la Edge Function Joyas con la imagen subida
		let aiResult = null;
		try {
			aiResult = await callEdgeFunction('Joyas', {
				nombre: formData.customerName,
				telefono: formData.customerPhone,
				email: formData.customerEmail,
				categoria_producto: formData.category,
				material: formData.material,
				gema_principal: formData.gemstone,
				estilo: formData.style,
				sugerencias: formData.instructions,
				imagen_subida_url: imageUrl,
			});
		} catch (aiError) {
			console.warn('[Romet] Edge function failed:', aiError);
			aiResult = { imagenUrl: null };
		}

		// 3. Mostrar pantalla de éxito
		showUploadSuccess(formData, aiResult, imagePreviewUrl);
