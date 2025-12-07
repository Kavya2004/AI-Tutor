function showMobileSection(section) {
    const chatSection = document.querySelector('.chat-section');
    const whiteboardSection = document.querySelector('.whiteboard-section');
    const chatNavBtn = document.getElementById('chatNavBtn');
    const whiteboardNavBtn = document.getElementById('whiteboardNavBtn');
    
    if (section === 'chat') {
        chatSection.classList.remove('mobile-hidden');
        whiteboardSection.classList.remove('mobile-active');
        chatNavBtn.classList.add('active');
        whiteboardNavBtn.classList.remove('active');
    } else if (section === 'whiteboard') {
        chatSection.classList.add('mobile-hidden');
        whiteboardSection.classList.add('mobile-active');
        chatNavBtn.classList.remove('active');
        whiteboardNavBtn.classList.add('active');
    }
}