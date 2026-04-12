(function() {
      'use strict';

     let designerData = {
               category: '',
               material: '',
               gemstone: '',
               style: '',
               budget: '',
               email: '',
               notes: ''
     };

     function init() {
               const path = window.location.pathname;
               const page = path.split('/').pop();

          loadFromStorage();
               hookUI();

          if (page === 'designer-paso7.html') {
                        setupFinalStep();
          }
     }

     function loadFromStorage() {
               const saved = localStorage.getItem('romet_designer_data');
               if (saved) {
                             designerData = JSON.parse(saved);
               }
     }

     function saveToStorage() {
               localStorage.setItem('romet_designer_data', JSON.stringify(designerData));
     }

     function hookUI() {
               // Step buttons
          const options = document.querySelectorAll('[onclick*="selectOption"]');
               options.forEach(opt => {
                             const originalOnClick = opt.getAttribute('onclick');
                             opt.onclick = (e) => {
                                               const match = originalOnClick.match(/'([^']+)'/);
                                               if (match) {
                                                                     const value = match[1];
                                                                     const category = window.location.pathname.includes('paso1') ? 'category' :
                                                                                                           window.location.pathname.includes('paso2') ? 'material' :
                                                                                                           window.location.pathname.includes('paso3') ? 'gemstone' :
                                                                                                           window.location.pathname.includes('paso4') ? 'style' :
                                                                                                           window.location.pathname.includes('paso5') ? 'budget' : '';
                                                                     if (category) designerData[category] = value;
                                                                     saveToStorage();
                                               }
                             };
               });

          // Next button integration
          const nextBtn = document.querySelector('a[href*="designer-paso"]');
               if (nextBtn) {
                             nextBtn.addEventListener('click', () => saveToStorage());
               }
     }

     async function setupFinalStep() {
               const form = document.querySelector('form');
               if (!form) return;

          form.addEventListener('submit', async (e) => {
                        e.preventDefault();
                        const email = document.querySelector('input[type="email"]')?.value;
                        const notes = document.querySelector('textarea')?.value;

                                            designerData.email = email;
                        designerData.notes = notes;
                        saveToStorage();

                                            try {
                                                              // Call Supabase Edge Function
                            const result = await callEdgeFunction('gemini-design', designerData);

                            // Save to database
                            await saveDesignOrder({
                                                  type: 'configurator',
                                                  ...designerData,
                                                  ai_analysis: result.analysis,
                                                  ai_feasibility: result.feasibility
                            });

                            // Send email
                            await callEdgeFunction('send-email', {
                                                  type: 'new_design_order',
                                                  to: email,
                                                  orderData: designerData
                            });

                            alert(''Pedido enviado con exito! Revisa tu correo.');
                                                              localStorage.removeItem('romet_designer_data');
                                                              window.location.href = 'index.html';
                                            } catch (err) {
                                                              console.error(err);
                                                              alert('Error al enviar el pedido.');
                                            }
          });
     }

     document.addEventListener('DOMContentLoaded', init);
})();
