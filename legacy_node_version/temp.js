
        // --- SECURE VERIFICATION ---
        let heroQuill; // Global reference for Quill
        let fullMatrix = null;
        let currentLang = 'en';

        // Verify session immediately before revealing the UI or loading data
        fetch('/api/verify-session')
            .then(res => {
                if (!res.ok) {
                    window.location.href = '/login.html'; // Redirect to login
                } else {
                    return res.json();
                }
            })
            .then(data => {
                if (data && data.success) {
                    document.getElementById('main-admin').style.display = 'block';
                    
                    // Initialize Hero Quill Editor
                    heroQuill = new Quill('#heroSubtextEditor', {
                        theme: 'snow',
                        modules: { toolbar: [['bold', 'italic', 'underline'], ['link']] }
                    });

                    // Initialize SortableJS
                    Sortable.create(document.getElementById('services-container'), { handle: '.drag-handle', animation: 150 });
                    Sortable.create(document.getElementById('stats-container'), { handle: '.drag-handle', animation: 150 });
                    Sortable.create(document.getElementById('projects-container'), { handle: '.drag-handle', animation: 150 });

                    // Initialize Character Counters
                    document.querySelectorAll('input[maxlength]').forEach(input => {
                        const counter = document.createElement('span');
                        counter.className = 'char-counter';
                        const max = input.getAttribute('maxlength');
                        input.parentNode.appendChild(counter);

                        const updateCounter = () => {
                            const len = input.value.length;
                            counter.textContent = `${len} / ${max}`;
                            counter.className = 'char-counter ' + (len >= max ? 'danger' : len >= max * 0.8 ? 'warning' : '');
                        };
                        input.addEventListener('input', updateCounter);
                        // Store the function so we can call it after data loads
                        input.updateCounter = updateCounter;
                    });

                    loadData();
                    // Load user ID for the Live Site button
                    fetch('/api/me')
                        .then(res => res.json())
                        .then(userData => {
                            if(userData.user_id) {
                                document.getElementById('live-site-link').href = `/INDEX.HTML?user_id=${userData.user_id}`;
                            }
                        });
                }
            })
            .catch(() => window.location.href = '/login.html');

        function loadData() {
            fetch('/api/admin-data')
                .then(res => res.json())
                .then(matrix => {
                    fullMatrix = matrix;
                    populateForm(fullMatrix.draft[currentLang]);
                });
        }

        function populateForm(data) {
            existingData = data;
            
            document.getElementById('brandName').value = data.brand.name || '';
            document.getElementById('heroTagline').value = data.hero.tagline || '';
            document.getElementById('heroHeadline').value = data.hero.headline || '';
            heroQuill.root.innerHTML = data.hero.subtext || '';
            document.getElementById('heroBgUrl').value = data.hero.bgImage || '';

            // Trigger character counters to update visually
            document.querySelectorAll('input[maxlength]').forEach(input => {
                if(input.updateCounter) input.updateCounter();
            });

            document.getElementById('services-container').innerHTML = '';
            document.getElementById('stats-container').innerHTML = '';
            document.getElementById('projects-container').innerHTML = '';
            document.getElementById('forms-container').innerHTML = '';

            if(data.servicesSection && data.servicesSection.items) {
                data.servicesSection.items.forEach(service => addServiceToForm(service));
            }
            if(data.stats) {
                data.stats.forEach(stat => addStatToForm(stat));
            }
            if(data.projectsSection && data.projectsSection.items) {
                data.projectsSection.items.forEach(proj => addProjectToForm(proj));
            }
            if(data.forms) {
                data.forms.forEach(form => addFormToBuilder(form));
            }
            
            updateInboxSelect();
            refreshMediaVault();
        }

        document.getElementById('lang-select').addEventListener('change', (e) => {
            fullMatrix.draft[currentLang] = collectFormData();
            currentLang = e.target.value;
            populateForm(fullMatrix.draft[currentLang]);
        });

        function showToast(message, type = 'success') {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.className = 'show ' + type;
            setTimeout(() => { toast.className = toast.className.replace('show', ''); }, 3000);
        }

        // FUNCTION: Load asset bank data from server storage and build library UI
        function refreshMediaVault() {
            const vaultContainer = document.getElementById('system-media-vault');
            if (!vaultContainer) return;

            fetch('/api/media')
                .then(res => res.json())
                .then(data => {
                    if (!data.success) return;
                    
                    vaultContainer.innerHTML = ''; // Clear prior render states
                    
                    if (data.media.length === 0) {
                        vaultContainer.innerHTML = `<p style="grid-column: 1/-1; color: #555; font-size: 0.8rem; text-align: center; margin: 20px 0;">No system files found. Upload your first asset above.</p>`;
                        return;
                    }

                    const currentActiveUrl = document.getElementById('heroBgUrl').value;

                    data.media.forEach(url => {
                        const card = document.createElement('div');
                        card.className = `media-thumb-card ${currentActiveUrl === url ? 'selected' : ''}`;
                        card.innerHTML = `
                            <img src="${url}" alt="Server Asset">
                            <button type="button" class="delete-asset-btn" title="Archive Asset"><i class="fa-solid fa-trash"></i></button>
                        `;
                        
                        card.addEventListener('click', function() {
                            document.querySelectorAll('.media-thumb-card').forEach(c => c.classList.remove('selected'));
                            card.classList.add('selected');
                            
                            document.getElementById('heroBgUrl').value = url;
                            showToast('Existing asset linked from cloud library!', 'success');
                        });

                        const deleteBtn = card.querySelector('.delete-asset-btn');
                        deleteBtn.addEventListener('click', function(e) {
                            e.stopPropagation();
                            if(confirm("Are you sure you want to remove this asset?")) {
                                fetch('/api/delete-media', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ url: url })
                                })
                                .then(res => res.json())
                                .then(data => {
                                    if(data.success) {
                                        showToast('Asset archived successfully!', 'success');
                                        refreshMediaVault();
                                        if (document.getElementById('heroBgUrl').value === url) {
                                            document.getElementById('heroBgUrl').value = '';
                                        }
                                    } else {
                                        showToast('Failed to archive asset.', 'error');
                                    }
                                });
                            }
                        });

                        vaultContainer.appendChild(card);
                    });
                });
        }

        function addServiceToForm(service = { icon: 'fa-solid fa-star', title: '', desc: '' }) {
            const container = document.getElementById('services-container');
            const div = document.createElement('div');
            div.className = 'dynamic-item';
            const editorId = 'svcDesc_' + Math.random().toString(36).substr(2, 9);
            
            div.innerHTML = `
                <i class="fa-solid fa-grip-vertical drag-handle"></i>
                <button type="button" class="remove-btn" onclick="this.parentElement.remove()">Remove</button>
                <div class="form-group"><label>Icon (FontAwesome class)</label><input type="text" class="svc-icon" value="${service.icon}" required></div>
                <div class="form-group"><label>Title</label><input type="text" class="svc-title" value="${service.title}" required maxlength="40"></div>
                <div class="form-group"><label>Description</label><div id="${editorId}" class="svc-desc" style="height: 100px;">${service.desc}</div></div>
            `;
            container.appendChild(div);
            
            const q = new Quill(`#${editorId}`, { theme: 'snow', modules: { toolbar: [['bold', 'italic']] } });
            div.quillInstance = q;
        }

        document.getElementById('add-service-btn').addEventListener('click', () => addServiceToForm());

        function addStatToForm(stat = { icon: 'fa-solid fa-chart-line', value: '', label: '' }) {
            const container = document.getElementById('stats-container');
            const div = document.createElement('div');
            div.className = 'dynamic-item';
            div.innerHTML = `
                <i class="fa-solid fa-grip-vertical drag-handle"></i>
                <button type="button" class="remove-btn" onclick="this.parentElement.remove()">Remove</button>
                <div class="form-group"><label>Icon (FontAwesome)</label><input type="text" class="stat-icon" value="${stat.icon}" required></div>
                <div class="form-group"><label>Value</label><input type="text" class="stat-val" value="${stat.value}" required maxlength="10"></div>
                <div class="form-group"><label>Label</label><input type="text" class="stat-label" value="${stat.label}" required maxlength="30"></div>
            `;
            container.appendChild(div);
        }
        document.getElementById('add-stat-btn').addEventListener('click', () => addStatToForm());

        function addProjectToForm(proj = { image: '', title: '', location: '', class: 'card-bot-mid' }) {
            const container = document.getElementById('projects-container');
            const div = document.createElement('div');
            div.className = 'dynamic-item';
            
            const fileId = 'projFile_' + Math.random().toString(36).substr(2, 9);
            
            div.innerHTML = `
                <i class="fa-solid fa-grip-vertical drag-handle"></i>
                <button type="button" class="remove-btn" onclick="this.parentElement.remove()">Remove</button>
                <div class="form-group">
                    <label>Project Image Upload</label>
                    <input type="file" id="${fileId}" accept="image/*">
                    <input type="hidden" class="proj-img" value="${proj.image}">
                    <span class="help-text">Upload an image for this project.</span>
                </div>
                <div class="form-group"><label>Title</label><input type="text" class="proj-title" value="${proj.title}" required></div>
                <div class="form-group"><label>Location</label><input type="text" class="proj-location" value="${proj.location}" required></div>
                <div class="form-group"><label>Layout Class (card-large-left, card-top-mid, card-bot-mid, card-large-right)</label><input type="text" class="proj-class" value="${proj.class}" required></div>
            `;
            container.appendChild(div);

            document.getElementById(fileId).addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (!file) return;
                const statusSpan = div.querySelector('.help-text');
                const hiddenInput = div.querySelector('.proj-img');
                
                statusSpan.textContent = "Uploading...";
                const formData = new FormData();
                formData.append('image', file);

                fetch('/api/upload-image', { method: 'POST', body: formData })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        hiddenInput.value = data.imageUrl;
                        statusSpan.textContent = "Uploaded successfully!";
                        statusSpan.style.color = "green";
                    } else {
                        statusSpan.textContent = "Upload failed.";
                        statusSpan.style.color = "red";
                    }
                });
            });
        }
        document.getElementById('add-project-btn').addEventListener('click', () => addProjectToForm());

        // --- FORM BUILDER LOGIC ---
        function addFormToBuilder(form = { id: 'form_' + Date.now(), title: '', fields: [] }) {
            const container = document.getElementById('forms-container');
            const div = document.createElement('div');
            div.className = 'dynamic-item form-item';
            div.dataset.id = form.id;
            
            let fieldsHtml = '';
            form.fields.forEach(f => {
                fieldsHtml += `
                    <div class="form-field-row" style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center;">
                        <input type="text" class="f-label" value="${f.label}" placeholder="Label (e.g. Email)">
                        <select class="f-type" style="padding: 10px; border-radius: 4px; background: #333; color: white; border: 1px solid #555;">
                            <option value="text" ${f.type === 'text' ? 'selected' : ''}>Short Text</option>
                            <option value="email" ${f.type === 'email' ? 'selected' : ''}>Email</option>
                            <option value="textarea" ${f.type === 'textarea' ? 'selected' : ''}>Paragraph</option>
                        </select>
                        <button type="button" class="btn" style="background:#e74c3c; padding:10px;" onclick="this.parentElement.remove(); updateInboxSelect();"><i class="fa-solid fa-trash"></i></button>
                    </div>
                `;
            });

            div.innerHTML = `
                <button type="button" class="remove-btn" onclick="this.parentElement.remove(); updateInboxSelect();">Remove Form</button>
                <div class="form-group">
                    <label>Form Title</label>
                    <input type="text" class="form-title" value="${form.title}" oninput="updateInboxSelect()" required>
                </div>
                <div class="form-group">
                    <label>Fields</label>
                    <div class="fields-list">${fieldsHtml}</div>
                    <button type="button" class="btn btn-secondary add-field-btn">+ Add Field</button>
                </div>
            `;
            
            div.querySelector('.add-field-btn').addEventListener('click', () => {
                const fieldsList = div.querySelector('.fields-list');
                const row = document.createElement('div');
                row.className = 'form-field-row';
                row.style.cssText = "display: flex; gap: 10px; margin-bottom: 10px; align-items: center;";
                row.innerHTML = `
                    <input type="text" class="f-label" placeholder="Label (e.g. Email)">
                    <select class="f-type" style="padding: 10px; border-radius: 4px; background: #333; color: white; border: 1px solid #555;">
                        <option value="text">Short Text</option>
                        <option value="email">Email</option>
                        <option value="textarea">Paragraph</option>
                    </select>
                    <button type="button" class="btn" style="background:#e74c3c; padding:10px;" onclick="this.parentElement.remove()"><i class="fa-solid fa-trash"></i></button>
                `;
                fieldsList.appendChild(row);
            });
            
            container.appendChild(div);
            updateInboxSelect();
        }
        document.getElementById('add-form-btn').addEventListener('click', () => addFormToBuilder());

        // --- INBOX LOGIC ---
        function updateInboxSelect() {
            const select = document.getElementById('inbox-select');
            const currentSelection = select.value;
            select.innerHTML = '<option value="">-- Select Form --</option>';
            const formItems = Array.from(document.querySelectorAll('#forms-container .form-item')).map(item => ({
                id: item.dataset.id, title: item.querySelector('.form-title').value
            }));
            formItems.forEach(f => {
                if(f.title) select.innerHTML += `<option value="${f.id}" ${f.id === currentSelection ? 'selected' : ''}>${f.title}</option>`;
            });
        }

        document.getElementById('inbox-select').addEventListener('change', (e) => {
            const formId = e.target.value;
            const container = document.getElementById('inbox-container');
            const exportBtn = document.getElementById('export-csv-btn');
            
            if(!formId) {
                container.innerHTML = '<p style="color: #777;">Select a form to view its leads.</p>';
                exportBtn.style.display = 'none';
                return;
            }
            
            const responses = (fullMatrix.draft[currentLang].responses || {})[formId] || [];
            if(responses.length === 0) {
                container.innerHTML = '<p style="color: #777;">No responses found for this form.</p>';
                exportBtn.style.display = 'none';
                return;
            }
            
            const currentFormData = collectFormData();
            const activeForm = (currentFormData.forms || []).find(f => f.id === formId);
            const headers = ['Date', ...(activeForm ? activeForm.fields.map(f => f.label) : [])];
            
            let html = '<table style="width:100%; border-collapse: collapse; margin-top:15px; color: white;"><tr>';
            headers.forEach(h => html += `<th style="padding:10px; background:#252627; border:1px solid #333; text-align:left;">${h}</th>`);
            html += '</tr>';
            
            responses.forEach(resp => {
                const date = new Date(resp.timestamp).toLocaleString();
                html += `<tr><td style="padding:10px; border:1px solid #333;">${date}</td>`;
                if(activeForm) {
                    activeForm.fields.forEach(f => {
                        const val = resp.data[f.label] || '';
                        html += `<td style="padding:10px; border:1px solid #333;">${val}</td>`;
                    });
                }
                html += '</tr>';
            });
            html += '</table>';
            
            container.innerHTML = html;
            exportBtn.style.display = 'inline-block';
            exportBtn.dataset.formid = formId;
        });

        document.getElementById('export-csv-btn').addEventListener('click', (e) => {
            const formId = e.target.dataset.formid;
            const currentFormData = collectFormData();
            const activeForm = (currentFormData.forms || []).find(f => f.id === formId);
            const responses = (fullMatrix.draft[currentLang].responses || {})[formId] || [];
            
            let csv = 'Date,' + (activeForm ? activeForm.fields.map(f => `"${f.label}"`).join(',') : '') + '\n';
            responses.forEach(resp => {
                csv += `"${new Date(resp.timestamp).toLocaleString()}",`;
                if(activeForm) {
                    csv += activeForm.fields.map(f => `"${(resp.data[f.label] || '').replace(/"/g, '""')}"`).join(',');
                }
                csv += '\n';
            });
            
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.setAttribute('href', url);
            a.setAttribute('download', `${activeForm.title.replace(/\s+/g, '_')}_Leads.csv`);
            a.click();
        });

        // --- IMAGE UPLOAD LOGIC ---
        document.getElementById('heroBgFile').addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            document.getElementById('heroBgStatus').textContent = "Uploading...";
            const formData = new FormData();
            formData.append('image', file);

            fetch('/api/upload-image', {
                method: 'POST',
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                if(data.success) {
                    document.getElementById('heroBgUrl').value = data.imageUrl;
                    document.getElementById('heroBgStatus').textContent = 'Upload complete! Image saved to cloud.';
                    document.getElementById('heroBgStatus').style.color = '#2ecc71';
                    showToast('Image uploaded and linked successfully!', 'success');
                    refreshMediaVault();
                } else {
                    document.getElementById('heroBgStatus').textContent = 'Upload failed: ' + data.message;
                    document.getElementById('heroBgStatus').style.color = '#e74c3c';
                }
            })
            .catch(err => console.error(err));
        });

        // --- SUBMISSION LOGIC ---
        function collectFormData() {
            const serviceItems = Array.from(document.querySelectorAll('#services-container .dynamic-item')).map(item => ({
                icon: item.querySelector('.svc-icon').value,
                title: item.querySelector('.svc-title').value,
                desc: item.quillInstance.root.innerHTML
            }));

            const statItems = Array.from(document.querySelectorAll('#stats-container .dynamic-item')).map(item => ({
                icon: item.querySelector('.stat-icon').value,
                value: item.querySelector('.stat-val').value,
                label: item.querySelector('.stat-label').value
            }));

            const projectItems = Array.from(document.querySelectorAll('#projects-container .dynamic-item')).map(item => ({
                image: item.querySelector('.proj-img').value,
                title: item.querySelector('.proj-title').value,
                location: item.querySelector('.proj-location').value,
                class: item.querySelector('.proj-class').value
            }));

            const formItems = Array.from(document.querySelectorAll('#forms-container .form-item')).map(item => {
                const id = item.dataset.id;
                const title = item.querySelector('.form-title').value;
                const fields = Array.from(item.querySelectorAll('.form-field-row')).map(row => ({
                    label: row.querySelector('.f-label').value,
                    type: row.querySelector('.f-type').value
                }));
                return { id, title, fields };
            });

            return {
                ...existingData,
                brand: {
                    ...existingData.brand,
                    name: document.getElementById('brandName').value
                },
                hero: {
                    ...existingData.hero,
                    tagline: document.getElementById('heroTagline').value,
                    headline: document.getElementById('heroHeadline').value,
                    subtext: heroQuill.root.innerHTML,
                    bgImage: document.getElementById('heroBgUrl').value
                },
                servicesSection: {
                    ...existingData.servicesSection,
                    items: serviceItems
                },
                stats: statItems,
                projectsSection: {
                    ...existingData.projectsSection,
                    items: projectItems
                },
                forms: formItems
            };
        }

        function submitForm(mode) {
            const payload = collectFormData();
            fullMatrix.draft[currentLang] = payload; 
            
            fetch('/api/save-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: mode, lang: currentLang, payload: payload })
            })
            .then(res => {
                if(res.status === 401 || res.status === 403) window.location.href = '/login.html';
                return res.json();
            })
            .then(response => {
                if(response.success) {
                    showToast('Website updated instantly!', 'success');
                } else {
                    showToast('Server error: ' + response.message, 'error');
                }
            })
            .catch(error => {
                console.error('Error saving data:', error);
                showToast('Failed to connect to the server.', 'error');
            });
            });
        }

        document.getElementById('save-draft-btn').addEventListener('click', () => submitForm('draft'));
        document.getElementById('publish-live-btn').addEventListener('click', () => submitForm('publish'));

        // --- BACKGROUND AUTO-SAVE ENGINE ---
        let lastSavedPayloadString = "";

        function configurationHasChanged(currentPayload) {
            const currentString = JSON.stringify(currentPayload);
            if (currentString !== lastSavedPayloadString) {
                lastSavedPayloadString = currentString;
                return true;
            }
            return false;
        }

        function triggerBackgroundAutoSave() {
            const currentPayload = collectFormData();
            const statusText = document.getElementById('autosave-status');

            if (!configurationHasChanged(currentPayload)) return;

            statusText.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Syncing staging draft automatically...`;
            statusText.style.color = '#d0aa69';

            fullMatrix.draft[currentLang] = currentPayload;
            
            fetch('/api/save-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'draft', lang: currentLang, payload: currentPayload })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    const now = new Date();
                    const timeString = now.toTimeString().split(' ')[0];
                    statusText.innerHTML = `<i class="fa-solid fa-cloud"></i> Draft auto-saved at ${timeString}`;
                    statusText.style.color = '#2ecc71';
                } else {
                    statusText.textContent = "Background sync suspended: Connection lost.";
                    statusText.style.color = '#e74c3c';
                }
            })
            .catch(() => {
                statusText.textContent = "Network error: Auto-save paused.";
                statusText.style.color = '#e74c3c';
            });
        }

        // Start checking loop 3 seconds after page loads
        setTimeout(() => {
            lastSavedPayloadString = JSON.stringify(collectFormData());
            setInterval(triggerBackgroundAutoSave, 30000);
        });

        // --- LIVE SYSTEM VITALS POLLING ---
        function pollSystemVitals() {
            fetch('/api/system/health')
                .then(res => res.json())
                .then(vitals => {
                    if (!vitals.success) return;
                    document.getElementById('health-mem').textContent = vitals.memory;
                    document.getElementById('health-cpu').textContent = vitals.loadAverage;
                    document.getElementById('health-uptime').textContent = vitals.uptime;
                })
                .catch(() => console.log('Telemetry synchronization suspended.'));
        }
        
        pollSystemVitals();
        setInterval(pollSystemVitals, 5000);

    