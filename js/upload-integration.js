(function() {
      'use strict';
      let selectedFile = null;
      let imagePreviewUrl = null;

     function getElements() {
               const root = document.getElementById('root') || document.body;
               return {
                             form: root.querySelector('form'),
                             dropzone: root.querySelector('[class*="border-dashed"]'),
                             fileInput: root.querySelector('input[type="file"]'),
                             instructionsTextarea: root.querySelector('textarea'),
                             nameInput: root.querySelector('input[type="text"]'),
                             emailInput: root.querySelector('input[type="email"]'),
                             submitBtn: root.querySelector('button[type="submit"]'),
               };
     }

     function init() {
               const els = getElements();
               if (!els.dropzone) return;

          els.dropzone.addEventListener('click', () => els.fileInput.click());
               els.fileInput.addEventListener('change', (e) => {
                             const file = e.target.files?.[0];
                             if (file) handleFileSelected(file);
               });

          if (els.form) {
                        els.form.addEventListener('submit', async (e) => {
                                          e.preventDefault();
                                          await handleSubmit();
                        });
          }
     }

     function handleFileSelected(file) {
               selectedFile = file;
               const reader = new FileReader();
               reader.onload = (e) => {
                             imagePreviewUrl = e.target.result;
                             const els = getElements();
                             els.dropzone.innerHTML = `<img src="${imagePreviewUrl}" style="max-height:200px; border-radius:8px;">`;
               };
               reader.readAsDataURL(file);
     }

     async function handleSubmit() {
               const els = getElements();
               const submitBtn = els.submitBtn;
               if (!selectedFile) return;

          submitBtn.disabled = true;
               submitBtn.textContent = 'Analizando...';

          try {
                        // 1. Upload to Storage
                   const imageUrl = await uploadImage(selectedFile);

                   // 2. AI Analysis
                   const aiResult = await callEdgeFunction('gemini-analyze-design', {
                                     imageBase64: imagePreviewUrl,
                                     imageUrl: imageUrl,
                                     instructions: els.instructionsTextarea?.value
                   });

                   // 3. Save Order
                   await saveDesignOrder({
                                     type: 'upload_design',
                                     customer_name: els.nameInput?.value,
                                     customer_email: els.emailInput?.value,
                                     notes: els.instructionsTextarea?.value,
                                     image_url: imageUrl,
                                     ai_analysis: aiResult.analysis
                   });

                   // 4. Send Email
                   await callEdgeFunction('send-email', {
                                     type: 'upload_design_order',
                                     to: els.emailInput?.value,
                                     customerName: els.nameInput?.value,
                                     orderData: { analysis: aiResult.analysis }
                   });

                   alert('Diseno enviado con exito.');
                        window.location.href = 'index.html';
          } catch (err) {
                        console.error(err);
                        alert('Error al procesar el diseno.');
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Enviar Diseno';
          }
     }

     document.addEventListener('DOMContentLoaded', init);
})();
