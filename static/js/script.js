document.addEventListener('DOMContentLoaded', () => {
    // Data structures
    let robotData = {
        testCases: [],
        variables: []
    };

    // Config from server
    const robotConfig = window.robotConfig || [];

    // Flatten config for easier lookup
    const flattenedKeywords = {};
    function flatten(nodes) {
        if (!nodes) return;
        nodes.forEach(node => {
            if (node.keywords) {
                node.keywords.forEach(kw => {
                    flattenedKeywords[kw.name] = kw;
                });
            }
            if (node.subcategories) {
                flatten(node.subcategories);
            }
        });
    }
    flatten(robotConfig);

    const generateBtn = document.getElementById('generate-btn');
    const downloadBtn = document.getElementById('download-btn');
    const robotOutput = document.getElementById('robot-output');
    const testCasesZone = document.getElementById('test-cases-zone');
    const propertiesForm = document.getElementById('properties-form');
    const settingsInput = document.getElementById('settings-input');

    // Variables Elements
    const addVarBtn = document.getElementById('add-var-btn');
    const varTypeInput = document.getElementById('var-type');
    const varNameInput = document.getElementById('var-name');
    const varValueInput = document.getElementById('var-value');
    const variablesListEl = document.getElementById('variables-list');

    // Dictionary Inputs
    const dictInputGroup = document.getElementById('dict-input-group');
    const dictKeyInput = document.getElementById('dict-key');
    const dictValueInput = document.getElementById('dict-value');
    const addDictItemBtn = document.getElementById('add-dict-item-btn');

    // Tab Elements
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // Import Elements
    const fileUpload = document.getElementById('robot-file-upload');
    const importBtn = document.getElementById('import-btn');
    const importStatus = document.getElementById('import-status');

    let selectedElement = null;

    // Enable TAB in Settings textarea
    settingsInput.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = this.selectionStart;
            const end = this.selectionEnd;

            // Insert 4 spaces for tab
            this.value = this.value.substring(0, start) + "    " + this.value.substring(end);

            // Move caret
            this.selectionStart = this.selectionEnd = start + 4;
        }
    });

    // Initialize UI
    renderKeywordsTree(robotConfig, document.getElementById('keywords-tree'));
    initializeDragAndDrop();

    // --- Tabs Logic ---
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
        });
    });

    // --- Import Logic ---
    importBtn.addEventListener('click', () => {
        const file = fileUpload.files[0];
        if (!file) {
            importStatus.innerHTML = '<span style="color:red">Please select a file.</span>';
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        importStatus.innerHTML = '<span>Uploading...</span>';

        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(res => {
            if (!res.ok) throw new Error("Upload failed");
            return res.json();
        })
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }

            // Populate Data
            settingsInput.value = data.settings || '';
            robotData.variables = data.variables || [];

            // Process Test Cases
            robotData.testCases = (data.testCases || []).map(tc => {
                // Map steps arguments to config if possible
                tc.steps = tc.steps.map(step => {
                    const knownKw = flattenedKeywords[step.name];
                    let mappedArgs = [];

                    if (knownKw && knownKw.args) {
                        // Map positional args from parsed step to named args from config
                        mappedArgs = knownKw.args.map((argDef, index) => {
                            // Find corresponding parsed arg or use default or empty
                            const parsedArg = step.args[index];
                            return {
                                name: argDef.name,
                                value: parsedArg ? parsedArg.value : ""
                            };
                        });
                    } else {
                        // Unknown keyword: treat args as generic positional
                        mappedArgs = step.args.map((arg, idx) => ({
                            name: `arg${idx+1}`,
                            value: arg.value
                        }));
                    }

                    return {
                        id: step.id,
                        name: step.name,
                        doc: knownKw ? knownKw.doc : "",
                        args: mappedArgs
                    };
                });
                return tc;
            });

            renderVariables();
            renderTestCases();
            importStatus.innerHTML = '<span style="color:green">Import successful! Switching to Design tab...</span>';

            setTimeout(() => {
                document.querySelector('[data-tab="design"]').click();
                importStatus.innerHTML = '';
            }, 1000);
        })
        .catch(err => {
            console.error(err);
            importStatus.innerHTML = `<span style="color:red">Error: ${err.message}</span>`;
        });
    });


    // --- Variables Logic ---

    // Toggle Dictionary Inputs
    varTypeInput.addEventListener('change', () => {
        if (varTypeInput.value === 'Dictionary') {
            dictInputGroup.style.display = 'flex';
        } else {
            dictInputGroup.style.display = 'none';
        }
    });

    // Add Dictionary Item
    addDictItemBtn.addEventListener('click', () => {
        const key = dictKeyInput.value.trim();
        const val = dictValueInput.value.trim();
        if (key && val) {
            const pair = `${key}=${val}`;
            if (varValueInput.value) {
                varValueInput.value += '\n' + pair;
            } else {
                varValueInput.value = pair;
            }
            dictKeyInput.value = '';
            dictValueInput.value = '';
            dictKeyInput.focus();
        }
    });

    addVarBtn.addEventListener('click', () => {
        const type = varTypeInput.value;
        const name = varNameInput.value.trim();
        const value = varValueInput.value;

        if (!name) {
            alert('Variable name is required');
            return;
        }

        robotData.variables.push({
            id: 'var_' + Date.now(),
            type: type,
            name: name,
            value: value
        });

        // Clear inputs
        varNameInput.value = '';
        varValueInput.value = '';
        renderVariables();
    });

    function removeVariable(id) {
        robotData.variables = robotData.variables.filter(v => v.id !== id);
        renderVariables();
    }

    function renderVariables() {
        variablesListEl.innerHTML = '';
        robotData.variables.forEach(variable => {
            const item = document.createElement('div');
            item.className = 'variable-item';

            let sigil = '$';
            if (variable.type === 'List') sigil = '@';
            if (variable.type === 'Dictionary') sigil = '&';

            const varInfo = document.createElement('div');
            varInfo.className = 'var-info';

            const strong = document.createElement('strong');
            strong.textContent = `${sigil}{${variable.name}}`;

            const span = document.createElement('span');
            span.className = 'var-value-preview';
            span.textContent = variable.value.replace(/\n/g, ', ');

            varInfo.appendChild(strong);
            varInfo.appendChild(span);
            item.appendChild(varInfo);

            const removeBtn = document.createElement('button');
            removeBtn.innerHTML = '&times;';
            removeBtn.className = 'remove-var-btn';
            removeBtn.onclick = () => removeVariable(variable.id);

            item.appendChild(removeBtn);
            variablesListEl.appendChild(item);
        });
    }


    // --- Tree View Rendering ---
    function renderKeywordsTree(nodes, container) {
        if (!nodes) return;

        const ul = document.createElement('ul');
        ul.className = 'tree-view';

        nodes.forEach(node => {
            const li = document.createElement('li');

            if (node.keywords) {
                // It is a category
                const span = document.createElement('span');
                span.className = 'tree-caret';
                span.textContent = node.category;
                span.onclick = function() {
                    this.parentElement.querySelector('.nested').classList.toggle('active');
                    this.classList.toggle('caret-down');
                };
                li.appendChild(span);

                const nestedUl = document.createElement('ul');
                nestedUl.className = 'nested';
                li.appendChild(nestedUl);

                // Render subcategories if any
                if (node.subcategories) {
                    renderKeywordsTree(node.subcategories, nestedUl);
                }

                // Render keywords
                node.keywords.forEach(kw => {
                    const kwLi = document.createElement('li');
                    const kwDiv = document.createElement('div');
                    kwDiv.className = 'draggable-item keyword-item';
                    kwDiv.draggable = true;
                    kwDiv.textContent = kw.name;
                    kwDiv.dataset.type = 'keyword';

                    kwDiv.dataset.keywordJson = JSON.stringify(kw);

                    kwLi.appendChild(kwDiv);
                    nestedUl.appendChild(kwLi);
                });

            } else if (node.subcategories) {
                 // Category with only subcategories
                const span = document.createElement('span');
                span.className = 'tree-caret';
                span.textContent = node.category;
                span.onclick = function() {
                    this.parentElement.querySelector('.nested').classList.toggle('active');
                    this.classList.toggle('caret-down');
                };
                li.appendChild(span);

                const nestedUl = document.createElement('ul');
                nestedUl.className = 'nested';
                li.appendChild(nestedUl);
                renderKeywordsTree(node.subcategories, nestedUl);
            }

            ul.appendChild(li);
        });

        container.appendChild(ul);
    }

    // --- Drag and Drop ---
    function initializeDragAndDrop() {
        const draggables = document.querySelectorAll('.draggable-item');
        document.querySelectorAll('.draggable-item').forEach(el => bindDragStart(el));
        const newTestCaseDrag = document.querySelector('.draggable-item[data-type="testcase"]');
        if (newTestCaseDrag) bindDragStart(newTestCaseDrag);

        testCasesZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            testCasesZone.classList.add('drag-over');
        });

        testCasesZone.addEventListener('dragleave', () => {
            testCasesZone.classList.remove('drag-over');
        });

        testCasesZone.addEventListener('drop', handleZoneDrop);
    }

    function bindDragStart(el) {
        el.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('type', el.dataset.type);
            if (el.dataset.type === 'keyword') {
                e.dataTransfer.setData('keywordJson', el.dataset.keywordJson);
            }
        });
    }

    function handleZoneDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove('drag-over');

        const type = e.dataTransfer.getData('type');

        if (type === 'testcase') {
            addTestCase();
        }
    }

    // --- Logic ---

    function addTestCase() {
        const id = 'tc_' + Date.now();
        const newTC = {
            id: id,
            name: 'New Test Case',
            doc: '',
            steps: []
        };
        robotData.testCases.push(newTC);
        renderTestCases();
    }

    function removeTestCase(id) {
        robotData.testCases = robotData.testCases.filter(tc => tc.id !== id);
        renderTestCases();
        clearPropertiesIfSelected('testcase', id);
    }

    function moveTestCase(id, direction) {
        const index = robotData.testCases.findIndex(tc => tc.id === id);
        if (index < 0) return;

        const newIndex = index + direction;
        if (newIndex >= 0 && newIndex < robotData.testCases.length) {
            const temp = robotData.testCases[index];
            robotData.testCases[index] = robotData.testCases[newIndex];
            robotData.testCases[newIndex] = temp;
            renderTestCases();
        }
    }

    function renderTestCases() {
        testCasesZone.innerHTML = '<div class="zone-label">Drop Test Cases Here</div>';

        robotData.testCases.forEach(tc => {
            const tcEl = document.createElement('div');
            tcEl.className = 'canvas-item test-case-item';
            tcEl.onclick = (e) => selectItem(e, 'testcase', tc);
            if (selectedElement && selectedElement.item.id === tc.id) {
                tcEl.classList.add('selected');
            }

            const header = document.createElement('div');
            const strong = document.createElement('strong');
            strong.textContent = tc.name;
            header.appendChild(strong);
            tcEl.appendChild(header);

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.innerHTML = '&times;';
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                removeTestCase(tc.id);
            };
            tcEl.appendChild(removeBtn);

            // Move buttons for Test Case
            const upBtn = document.createElement('button');
            upBtn.className = 'move-btn tc-move-btn move-up';
            upBtn.innerHTML = '&#8593;';
            upBtn.onclick = (e) => { e.stopPropagation(); moveTestCase(tc.id, -1); };
            tcEl.appendChild(upBtn);

            const downBtn = document.createElement('button');
            downBtn.className = 'move-btn tc-move-btn move-down';
            downBtn.innerHTML = '&#8595;';
            downBtn.onclick = (e) => { e.stopPropagation(); moveTestCase(tc.id, 1); };
            tcEl.appendChild(downBtn);


            // Steps Container
            const stepsContainer = document.createElement('div');
            stepsContainer.className = 'steps-container';

            stepsContainer.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                stepsContainer.style.borderColor = '#0969da';
            });
            stepsContainer.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                stepsContainer.style.borderColor = '#d0d7de';
            });
            stepsContainer.addEventListener('drop', (e) => handleStepDrop(e, tc.id));

            let indentLevel = 0;
            tc.steps.forEach(step => {
                const stepName = step.name.toUpperCase();
                let currentIndent = indentLevel;

                // Decrease indent before rendering for closing/middle blocks
                if (stepName === 'END') {
                    indentLevel = Math.max(0, indentLevel - 1);
                    currentIndent = indentLevel;
                } else if (['ELSE', 'ELSE IF', 'EXCEPT', 'FINALLY'].includes(stepName)) {
                    currentIndent = Math.max(0, indentLevel - 1);
                }

                const stepEl = document.createElement('div');
                stepEl.className = 'canvas-item step-item';
                stepEl.textContent = step.name;
                stepEl.style.marginLeft = (currentIndent * 20) + 'px';

                stepEl.onclick = (e) => {
                    e.stopPropagation();
                    selectItem(e, 'keyword', step, tc.id);
                };
                if (selectedElement && selectedElement.item.id === step.id) {
                    stepEl.classList.add('selected');
                }

                const rmBtn = document.createElement('button');
                rmBtn.className = 'remove-btn';
                rmBtn.innerHTML = '&times;';
                rmBtn.onclick = (e) => {
                    e.stopPropagation();
                    removeStep(tc.id, step.id);
                };
                stepEl.appendChild(rmBtn);

                const upBtn = document.createElement('button');
                upBtn.className = 'move-btn move-up';
                upBtn.innerHTML = '&#8593;';
                upBtn.onclick = (e) => { e.stopPropagation(); moveStep(tc.id, step.id, -1); };
                stepEl.appendChild(upBtn);

                const downBtn = document.createElement('button');
                downBtn.className = 'move-btn move-down';
                downBtn.innerHTML = '&#8595;';
                downBtn.onclick = (e) => { e.stopPropagation(); moveStep(tc.id, step.id, 1); };
                stepEl.appendChild(downBtn);

                stepsContainer.appendChild(stepEl);

                // Increase indent after rendering for opening blocks
                if (['IF', 'FOR', 'WHILE', 'TRY', 'ELSE', 'ELSE IF', 'EXCEPT', 'FINALLY'].includes(stepName)) {
                    indentLevel++;
                }
            });

            tcEl.appendChild(stepsContainer);
            testCasesZone.appendChild(tcEl);
        });
    }

    function handleStepDrop(e, tcId) {
        e.preventDefault();
        e.stopPropagation();
        e.target.style.borderColor = '#d0d7de';

        const type = e.dataTransfer.getData('type');
        if (type !== 'keyword' && type !== 'custom_keyword') return;

        const tc = robotData.testCases.find(t => t.id === tcId);
        if (!tc) return;

        const stepId = 'step_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

        if (type === 'custom_keyword') {
             const newStep = {
                id: stepId,
                name: 'Custom Keyword',
                doc: 'Custom user defined keyword',
                args: [],
                isCustom: true
            };
            tc.steps.push(newStep);
            renderTestCases();
            return;
        }

        const kwJson = e.dataTransfer.getData('keywordJson');
        if (!kwJson) return;

        const keywordConfig = JSON.parse(kwJson);

        let initialArgs = [];
        if (keywordConfig.args && Array.isArray(keywordConfig.args)) {
            initialArgs = keywordConfig.args.map(arg => ({
                name: arg.name,
                value: arg.default || ""
            }));
        }

        const newStep = {
            id: stepId,
            name: keywordConfig.name,
            doc: keywordConfig.doc,
            args: initialArgs
        };
        tc.steps.push(newStep);
        renderTestCases();
    }

    function removeStep(tcId, stepId) {
        const tc = robotData.testCases.find(t => t.id === tcId);
        if (tc) {
            tc.steps = tc.steps.filter(s => s.id !== stepId);
            renderTestCases();
            clearPropertiesIfSelected('keyword', stepId);
        }
    }

    function moveStep(tcId, stepId, direction) {
        const tc = robotData.testCases.find(t => t.id === tcId);
        if (tc) {
            const index = tc.steps.findIndex(s => s.id === stepId);
            if (index < 0) return;

            const newIndex = index + direction;
            if (newIndex >= 0 && newIndex < tc.steps.length) {
                const temp = tc.steps[index];
                tc.steps[index] = tc.steps[newIndex];
                tc.steps[newIndex] = temp;
                renderTestCases();
            }
        }
    }

    // --- Properties ---

    function selectItem(e, type, item, parentId = null) {
        if (e) e.stopPropagation();
        selectedElement = { type, item, parentId };
        renderTestCases();
        renderProperties(type, item);
    }

    function clearPropertiesIfSelected(type, id) {
        if (selectedElement && selectedElement.type === type && selectedElement.item.id === id) {
            selectedElement = null;
            propertiesForm.innerHTML = '<p class="placeholder-text">Select an element to edit its properties.</p>';
        }
    }

    function renderProperties(type, item) {
        let html = '';

        if (type === 'testcase') {
            html = `
                <div class="form-group">
                    <label>Test Case Name</label>
                    <input type="text" id="prop-tc-name" value="${item.name}">
                </div>
                <div class="form-group">
                    <label>Documentation</label>
                    <textarea id="prop-tc-doc" rows="3">${item.doc || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Tags/Labels (comma separated)</label>
                    <input type="text" id="prop-tc-tags" value="${(item.tags || []).join(', ')}">
                </div>
                <div class="form-group">
                    <label>Test Setup</label>
                    <input type="text" id="prop-tc-setup" value="${item.setup || ''}">
                </div>
                <div class="form-group">
                    <label>Test Teardown</label>
                    <input type="text" id="prop-tc-teardown" value="${item.teardown || ''}">
                </div>
            `;
            propertiesForm.innerHTML = html;

            document.getElementById('prop-tc-name').addEventListener('input', (e) => {
                item.name = e.target.value;
                renderTestCases();
            });
            document.getElementById('prop-tc-doc').addEventListener('input', (e) => {
                item.doc = e.target.value;
            });
            document.getElementById('prop-tc-tags').addEventListener('input', (e) => {
                // Split by comma, trim whitespace, filter empty strings
                item.tags = e.target.value.split(',').map(t => t.trim()).filter(t => t);
            });
            document.getElementById('prop-tc-setup').addEventListener('input', (e) => {
                item.setup = e.target.value;
            });
            document.getElementById('prop-tc-teardown').addEventListener('input', (e) => {
                item.teardown = e.target.value;
            });

        } else if (type === 'keyword') {
            if (item.isCustom) {
                html = `
                    <div class="form-group">
                        <label>Keyword Name</label>
                        <input type="text" id="prop-custom-kw-name" value="${item.name}">
                    </div>
                    <div class="form-group">
                        <label>Arguments</label>
                        <div id="custom-args-list"></div>
                        <button id="add-arg-btn" style="margin-top:10px; width:100%;">+ Add Argument</button>
                    </div>
                `;
                propertiesForm.innerHTML = html;

                const nameInput = document.getElementById('prop-custom-kw-name');
                const argsList = document.getElementById('custom-args-list');
                const addArgBtn = document.getElementById('add-arg-btn');

                nameInput.addEventListener('input', (e) => {
                    item.name = e.target.value;
                    renderTestCases();
                });

                const renderCustomArgs = () => {
                    argsList.innerHTML = '';
                    item.args.forEach((arg, index) => {
                        const row = document.createElement('div');
                        row.style.display = 'flex';
                        row.style.gap = '5px';
                        row.style.marginBottom = '5px';

                        const input = document.createElement('input');
                        input.type = 'text';
                        input.value = arg.value;
                        input.placeholder = 'Value';
                        input.style.flex = '1';
                        input.addEventListener('input', (e) => {
                            arg.value = e.target.value;
                        });

                        const removeBtn = document.createElement('button');
                        removeBtn.innerHTML = '&times;';
                        removeBtn.style.width = '30px';
                        removeBtn.style.color = 'red';
                        removeBtn.onclick = () => {
                            item.args.splice(index, 1);
                            renderCustomArgs();
                        };

                        row.appendChild(input);
                        row.appendChild(removeBtn);
                        argsList.appendChild(row);
                    });
                };

                addArgBtn.onclick = () => {
                    item.args.push({ name: `arg${item.args.length + 1}`, value: '' });
                    renderCustomArgs();
                };

                renderCustomArgs();

            } else {
                html = `
                    <div class="form-group">
                        <label>Keyword</label>
                        <input type="text" value="${item.name}" disabled style="background:#f6f8fa;">
                    </div>
                `;

                if (item.doc) {
                    html += `<div style="font-size:12px; color:#666; margin-bottom:10px;">${item.doc}</div>`;
                }

                // Args (List)
                if (item.args && item.args.length > 0) {
                    html += '<h4>Arguments</h4>';
                    item.args.forEach((arg, index) => {
                        html += `
                            <div class="form-group">
                                <label>${arg.name}</label>
                                <input type="text" class="prop-arg-input" data-index="${index}" value="${arg.value}">
                            </div>
                        `;
                    });
                } else {
                    html += '<p>No arguments.</p>';
                }

                propertiesForm.innerHTML = html;

                const inputs = propertiesForm.querySelectorAll('.prop-arg-input');
                inputs.forEach(input => {
                    input.addEventListener('input', (e) => {
                        const index = e.target.dataset.index;
                        item.args[index].value = e.target.value;
                    });
                });
            }
        }
    }

    // --- Generation ---

    generateBtn.addEventListener('click', () => {
        const payload = {
            settings: settingsInput.value,
            variables: robotData.variables,
            testCases: robotData.testCases
        };

        fetch('/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            console.log("Received data:", data);
            robotOutput.value = data.robot;
            downloadBtn.style.display = 'inline-block';
        })
        .catch(err => console.error(err));
    });

    downloadBtn.addEventListener('click', () => {
        const content = robotOutput.value;
        if (!content) return;

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tests.robot';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // Contact Modal Logic
    const contactBtn = document.getElementById('contact-btn');
    const contactModal = document.getElementById('contact-modal');
    const modalCloseBtn = document.querySelector('.modal-close');

    function openModal() {
        if (contactModal) {
            contactModal.classList.add('active');
        }
    }

    function closeModal() {
        if (contactModal) {
            contactModal.classList.remove('active');
        }
    }

    if (contactBtn) {
        contactBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openModal();
        });
    }

    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', closeModal);
    }

    // Close on outside click
    if (contactModal) {
        contactModal.addEventListener('click', (e) => {
            if (e.target === contactModal) {
                closeModal();
            }
        });
    }

});
