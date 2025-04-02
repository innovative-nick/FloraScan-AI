document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const uploadBtn = document.getElementById('uploadBtn');
    const cameraBtn = document.getElementById('cameraBtn');
    const fileInput = document.getElementById('fileInput');
    const cameraView = document.getElementById('cameraView');
    const captureBtn = document.getElementById('captureBtn');
    const plantImage = document.getElementById('plantImage');
    const errorMessage = document.getElementById('errorMessage');
    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    
    // API Key
    const API_KEY = '0906nltMyvsy4iG56SES2xDrNBHTfWvXp81F5lQB1rHgeB0ldc';
    let stream = null;
    
    // Event Listeners
    uploadBtn.addEventListener('click', () => fileInput.click());
    cameraBtn.addEventListener('click', startCamera);
    captureBtn.addEventListener('click', capturePhoto);
    fileInput.addEventListener('change', handleFileSelect);
    
    // Camera Functions
    async function startCamera() {
        try {
            // Hide other elements
            plantImage.style.display = 'none';
            results.style.display = 'none';
            errorMessage.textContent = '';
            
            // Get camera stream
            stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'environment' 
                },
                audio: false 
            });
            
            // Show camera view
            cameraView.srcObject = stream;
            cameraView.style.display = 'block';
            captureBtn.style.display = 'block';
            
        } catch (error) {
            console.error('Camera error:', error);
            showError('Could not access camera. Please ensure you have granted camera permissions.');
        }
    }
    
    function capturePhoto() {
        if (!stream) return;
        
        // Create canvas to capture photo
        const canvas = document.createElement('canvas');
        canvas.width = cameraView.videoWidth;
        canvas.height = cameraView.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(cameraView, 0, 0, canvas.width, canvas.height);
        
        // Convert to blob and handle as file
        canvas.toBlob(async (blob) => {
            const file = new File([blob], 'plant-photo.jpg', { type: 'image/jpeg' });
            await handleImageFile(file);
            
            // Stop camera
            stopCamera();
        }, 'image/jpeg', 0.9);
    }
    
    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        cameraView.style.display = 'none';
        captureBtn.style.display = 'none';
        cameraView.srcObject = null;
    }
    
    // Image Handling
    async function handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        await handleImageFile(file);
    }
    
    async function handleImageFile(file) {
        try {
            setLoading(true);
            clearResults();
            
            // Display image
            plantImage.src = URL.createObjectURL(file);
            plantImage.style.display = 'block';
            
            // Identify plant
            const plantData = await identifyPlant(file);
            await displayResults(plantData);
            
        } catch (error) {
            console.error('Error:', error);
            showError('Failed to identify plant. Please try again.');
        } finally {
            setLoading(false);
        }
    }
    
    // Plant Identification
    async function identifyPlant(file) {
        const formData = new FormData();
        formData.append('images', file);
        
        const response = await fetch('https://api.plant.id/v2/identify', {
            method: 'POST',
            headers: {
                'Api-Key': API_KEY
            },
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('API request failed');
        }
        
        return await response.json();
    }
    
    // Results Display
    async function displayResults(data) {
        if (!data.suggestions || data.suggestions.length === 0) {
            showError('No plant identified. Try a clearer photo.');
            return;
        }
        
        const plant = data.suggestions[0];
        let resultHTML = '';
        
        // Scientific name
        resultHTML += `<div class="result-heading">${plant.plant_name}</div>`;
        
        // Full scientific name (if available)
        if (plant.plant_details?.scientific_name) {
            resultHTML += `<div>${plant.plant_details.scientific_name}</div>`;
        }
        
        // Wikipedia link
        if (plant.plant_details?.url) {
            resultHTML += `<div><a href="${plant.plant_details.url}" target="_blank">${plant.plant_details.url}</a></div>`;
        }
        
        // Image credit (if available)
        if (plant.plant_details?.image_url) {
            resultHTML += `<div>CC BY-SA 3.0 : <a href="${plant.plant_details.image_url}" target="_blank">${plant.plant_details.image_url}</a></div>`;
        }
        
        // Common names
        resultHTML += `<div class="result-heading">Common names</div>`;
        if (plant.plant_details?.common_names && plant.plant_details.common_names.length > 0) {
            resultHTML += `<div>${plant.plant_details.common_names.join('<br>')}</div>`;
        } else {
            // Fallback to Wikipedia data if no common names
            const wikiData = await fetchWikipediaData(plant.plant_name);
            if (wikiData?.commonNames) {
                resultHTML += `<div>${wikiData.commonNames.join('<br>')}</div>`;
            }
        }
        
        // Description
        resultHTML += `<div class="result-heading">Description</div>`;
        if (plant.plant_details?.wiki_description?.value) {
            resultHTML += `<div>${plant.plant_details.wiki_description.value}</div>`;
        } else {
            // Fallback to Wikipedia description
            const wikiData = await fetchWikipediaData(plant.plant_name);
            if (wikiData?.description) {
                resultHTML += `<div>${wikiData.description}</div>`;
            }
        }
        
        // Wikipedia credit (if available)
        if (plant.plant_details?.url) {
            resultHTML += `<div>CC BY-SA 3.0 : <a href="${plant.plant_details.url}" target="_blank">${plant.plant_details.url}</a></div>`;
        }
        
        // Taxonomy
        resultHTML += `<div class="result-heading">Taxonomy</div>`;
        const taxonomy = [];
        if (plant.plant_details?.kingdom) taxonomy.push(`Kingdom: ${plant.plant_details.kingdom}`);
        if (plant.plant_details?.phylum) taxonomy.push(`Phylum: ${plant.plant_details.phylum}`);
        if (plant.plant_details?.class) taxonomy.push(`Class: ${plant.plant_details.class}`);
        if (plant.plant_details?.order) taxonomy.push(`Order: ${plant.plant_details.order}`);
        if (plant.plant_details?.family) taxonomy.push(`Family: ${plant.plant_details.family}`);
        if (plant.plant_details?.genus) taxonomy.push(`Genus: ${plant.plant_details.genus}`);
        
        if (taxonomy.length > 0) {
            resultHTML += `<div>${taxonomy.join('<br>')}</div>`;
        } else {
            // Fallback to Wikipedia taxonomy
            const wikiData = await fetchWikipediaData(plant.plant_name);
            if (wikiData?.taxonomy) {
                resultHTML += `<div>${wikiData.taxonomy.join('<br>')}</div>`;
            }
        }
        
        // Propagation methods
        resultHTML += `<div class="result-heading">Propagation methods</div><div>seeds</div>`;
        
        // Display the formatted results
        results.innerHTML = resultHTML;
        results.style.display = 'block';
    }
    
    // Wikipedia Integration
    async function fetchWikipediaData(plantName) {
        try {
            // First find the Wikipedia page
            const searchResponse = await fetch(
                `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(plantName)}&format=json&origin=*`
            );
            const searchData = await searchResponse.json();
            
            if (!searchData.query?.search?.length) return null;
            
            const pageTitle = searchData.query.search[0].title;
            
            // Get page content
            const contentResponse = await fetch(
                `https://en.wikipedia.org/w/api.php?action=query&prop=extracts|pageprops&exintro=true&explaintext=true&titles=${encodeURIComponent(pageTitle)}&format=json&origin=*`
            );
            const contentData = await contentResponse.json();
            const page = contentData.query.pages[Object.keys(contentData.query.pages)[0]];
            
            // Extract common names from pageprops
            let commonNames = [];
            if (page.pageprops?.common_name) {
                commonNames = page.pageprops.common_name.split(',');
            }
            
            // Try to extract taxonomy from the text
            let taxonomy = [];
            if (page.extract) {
                const taxonomyRegex = /Kingdom:\s*(.*?)\n|Phylum:\s*(.*?)\n|Class:\s*(.*?)\n|Order:\s*(.*?)\n|Family:\s*(.*?)\n|Genus:\s*(.*?)(\n|$)/gi;
                const matches = page.extract.matchAll(taxonomyRegex);
                for (const match of matches) {
                    if (match[1]) taxonomy.push(`Kingdom: ${match[1]}`);
                    if (match[2]) taxonomy.push(`Phylum: ${match[2]}`);
                    if (match[3]) taxonomy.push(`Class: ${match[3]}`);
                    if (match[4]) taxonomy.push(`Order: ${match[4]}`);
                    if (match[5]) taxonomy.push(`Family: ${match[5]}`);
                    if (match[6]) taxonomy.push(`Genus: ${match[6]}`);
                }
            }
            
            return {
                description: page.extract || '',
                commonNames: commonNames,
                taxonomy: taxonomy
            };
        } catch (error) {
            console.error('Wikipedia API error:', error);
            return null;
        }
    }
    
    // Utility Functions
    function clearResults() {
        results.style.display = 'none';
        plantImage.style.display = 'none';
        errorMessage.textContent = '';
        results.innerHTML = '';
    }
    
    function setLoading(show) {
        loading.style.display = show ? 'flex' : 'none';
    }
    
    function showError(message) {
        errorMessage.textContent = message;
        setTimeout(() => errorMessage.textContent = '', 5000);
    }
    
    // Clean up camera when leaving page
    window.addEventListener('beforeunload', () => {
        stopCamera();
    });
});