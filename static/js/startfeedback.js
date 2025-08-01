const stars = document.querySelectorAll('.star-rating .star');
const messageEl = document.getElementById('message');
const ratingTextEl = document.getElementById('rating-text');

let selectedRating = 0;

const ratingTexts = {
  1: "แย่มาก",
  2: "ไม่พอใจ", 
  3: "ปานกลาง",
  4: "ดี",
  5: "ยอดเยี่ยม!"
};

// ✅ ส่ง rating + ratingText ไปยัง Flask API
function sendRating(rating) {
  const ratingText = ratingTexts[rating];
  messageEl.style.color = '#4CAF50';
  messageEl.textContent = 'กำลังส่งคะแนน...';

  fetch('/submit-rating', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      rating: rating,
      ratingText: ratingText
    })
  })
  .then(res => res.json())
  .then(data => {
    messageEl.style.color = '#4CAF50';
    messageEl.textContent = data.message || 'ขอบคุณสำหรับคะแนนของคุณ!';
  })
  .catch(err => {
    messageEl.style.color = '#ff6b6b';
    messageEl.textContent = 'เกิดข้อผิดพลาดในการส่งข้อมูล';
    console.error(err);
  });
}

// ⭐ การจัดการการคลิกและเมาส์
stars.forEach(star => {
  star.addEventListener('mouseover', () => {
    const val = parseInt(star.dataset.value);
    highlightStars(val);
    ratingTextEl.textContent = ratingTexts[val];
  });

  star.addEventListener('mouseout', () => {
    highlightStars(selectedRating);
    ratingTextEl.textContent = selectedRating > 0 ? ratingTexts[selectedRating] : "";
  });

  star.addEventListener('click', () => {
    selectedRating = parseInt(star.dataset.value);
    highlightStars(selectedRating);
    ratingTextEl.textContent = ratingTexts[selectedRating];
    sendRating(selectedRating);
  });
});

// ⭐ ไฮไลต์ดาว
function highlightStars(rating) {
  stars.forEach(star => {
    const val = parseInt(star.dataset.value);
    star.classList.toggle('selected', val <= rating);
  });
}
