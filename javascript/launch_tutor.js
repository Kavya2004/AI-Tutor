function openDicePage() {
	var tutorWindow = window.open('tutor.html', 'TutorPage', 
		'width=1200,height=800,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no');
	
	if (!tutorWindow || tutorWindow.closed) {
		alert('Unable to open tutor window. Please allow popups for this site.');
		return;
	}
}

function toggleSettings() {
    const settings = document.getElementById('dice-settings');
    settings.classList.toggle('show');
}

function initializeDiceCustomization() {
    const bgColorInput = document.getElementById('bg-color');
    const hoverColorInput = document.getElementById('hover-color');
    const iconUpload = document.getElementById('icon-upload');
    const resetIcon = document.getElementById('reset-icon');
    const resetColors = document.getElementById('reset-colors');
    const resetAll = document.getElementById('reset-all');
    const closeSettings = document.getElementById('close-settings');
    const diceIcon = document.getElementById('dice-icon');
    
    if (!bgColorInput || !hoverColorInput || !iconUpload || !resetIcon || !closeSettings || !diceIcon) {
        return; 
    }
    
    const savedBgColor = localStorage.getItem('dice-bg-color') || '#337810';
    const savedHoverColor = localStorage.getItem('dice-hover-color') || '#2a6209';
    const savedIcon = localStorage.getItem('dice-custom-icon');
    
    document.documentElement.style.setProperty('--dice-bg-color', savedBgColor);
    document.documentElement.style.setProperty('--dice-hover-color', savedHoverColor);
    bgColorInput.value = savedBgColor;
    hoverColorInput.value = savedHoverColor;
    
    if (savedIcon) {
        diceIcon.src = savedIcon;
        document.documentElement.style.setProperty('--dice-icon-filter', 'none');
    }
    
    bgColorInput.addEventListener('change', function() {
        document.documentElement.style.setProperty('--dice-bg-color', this.value);
        localStorage.setItem('dice-bg-color', this.value);
    });
    
    hoverColorInput.addEventListener('change', function() {
        document.documentElement.style.setProperty('--dice-hover-color', this.value);
        localStorage.setItem('dice-hover-color', this.value);
    });
    
    iconUpload.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                diceIcon.src = e.target.result;
                document.documentElement.style.setProperty('--dice-icon-filter', 'none');
                localStorage.setItem('dice-custom-icon', e.target.result);
            };
            reader.readAsDataURL(file);
        }
    });
    
    resetIcon.addEventListener('click', function() {
        diceIcon.src = 'images/dice.png';
        document.documentElement.style.setProperty('--dice-icon-filter', 'invert(1) brightness(2)');
        localStorage.removeItem('dice-custom-icon');
        iconUpload.value = '';
    });
    
    if (resetColors) {
        resetColors.addEventListener('click', function() {
            const originalBgColor = '#337810';
            const originalHoverColor = '#2a6209';
            
            document.documentElement.style.setProperty('--dice-bg-color', originalBgColor);
            document.documentElement.style.setProperty('--dice-hover-color', originalHoverColor);
            bgColorInput.value = originalBgColor;
            hoverColorInput.value = originalHoverColor;
            
            localStorage.removeItem('dice-bg-color');
            localStorage.removeItem('dice-hover-color');
        });
    }
    
    if (resetAll) {
        resetAll.addEventListener('click', function() {
            const originalBgColor = '#337810';
            const originalHoverColor = '#2a6209';
            
            document.documentElement.style.setProperty('--dice-bg-color', originalBgColor);
            document.documentElement.style.setProperty('--dice-hover-color', originalHoverColor);
            bgColorInput.value = originalBgColor;
            hoverColorInput.value = originalHoverColor;
            
            diceIcon.src = 'images/dice.png';
            document.documentElement.style.setProperty('--dice-icon-filter', 'invert(1) brightness(2)');
            iconUpload.value = '';
            
            localStorage.removeItem('dice-bg-color');
            localStorage.removeItem('dice-hover-color');
            localStorage.removeItem('dice-custom-icon');
        });
    }
    
    closeSettings.addEventListener('click', function() {
        document.getElementById('dice-settings').classList.remove('show');
    });
}

document.addEventListener('DOMContentLoaded', initializeDiceCustomization);