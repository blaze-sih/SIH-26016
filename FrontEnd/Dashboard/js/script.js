// ============ Nav active state ============
document.querySelectorAll('[data-nav]').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('[data-nav]').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
  });
});

// ============ Chart data sets (7 / 30 / 90 days) ============
const dataSets = {
  7: {
    labels: ['06 Aug', '07 Aug', '08 Aug', '09 Aug', '10 Aug', '11 Aug', '12 Aug'],
    submitted: [11, 9, 7, 13, 11, 14, 12],
    verified:  [8, 7, 6, 9, 8, 10, 9],
    approved:  [5, 5, 4, 7, 7, 9, 8]
  },
  30: {
    labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'],
    submitted: [9, 12, 10, 14, 11, 15, 13, 16],
    verified:  [6, 9, 8, 10, 9, 11, 10, 12],
    approved:  [4, 6, 6, 8, 7, 9, 8, 10]
  },
  90: {
    labels: ['May', 'Jun', 'Jul', 'Aug', 'Sep'],
    submitted: [10, 12, 11, 13, 14],
    verified:  [7, 9, 8, 9, 10],
    approved:  [5, 7, 6, 8, 9]
  }
};

const teal = '#207E85';
const amber = '#b8860b';
const green = '#1f8a4c';

function withAlpha(hex, alpha){
  const c = hex.replace('#','');
  const r = parseInt(c.substring(0,2),16);
  const g = parseInt(c.substring(2,4),16);
  const b = parseInt(c.substring(4,6),16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const activityCtx = document.getElementById('activityChart').getContext('2d');
let activityChart = new Chart(activityCtx, {
  type: 'line',
  data: buildActivityData(dataSets[7]),
  options: activityOptions()
});

function buildActivityData(set){
  return {
    labels: set.labels,
    datasets: [
      {
        label: 'Submitted',
        data: set.submitted,
        borderColor: teal,
        backgroundColor: withAlpha(teal, 0.08),
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 4
      },
      {
        label: 'Verified',
        data: set.verified,
        borderColor: amber,
        backgroundColor: 'transparent',
        borderWidth: 2,
        tension: 0.4,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 4
      },
      {
        label: 'Approved',
        data: set.approved,
        borderColor: green,
        backgroundColor: 'transparent',
        borderWidth: 2,
        tension: 0.4,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 4
      }
    ]
  };
}

function activityOptions(){
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#16202e',
        padding: 10,
        cornerRadius: 8,
        titleFont: { size: 12, weight: '600' },
        bodyFont: { size: 12 }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#9aa4b2', font: { size: 11 } }
      },
      y: {
        beginAtZero: true,
        grid: { color: '#eef1f4' },
        ticks: { color: '#9aa4b2', font: { size: 11 }, stepSize: 4 }
      }
    }
  };
}

document.querySelectorAll('.range-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const range = btn.dataset.range;
    activityChart.data = buildActivityData(dataSets[range]);
    activityChart.update();
  });
});

// ============ Distribution bar chart ============
const distCtx = document.getElementById('distributionChart').getContext('2d');
new Chart(distCtx, {
  type: 'bar',
  data: {
    labels: ['Pending', 'In Review', 'Approved', 'Rejected'],
    datasets: [{
      data: [18, 7, 142, 5],
      backgroundColor: [amber, '#2563eb', green, '#d64545'],
      borderRadius: 5,
      maxBarThickness: 46
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#16202e',
        padding: 10,
        cornerRadius: 8
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#9aa4b2', font: { size: 11 } }
      },
      y: {
        beginAtZero: true,
        max: 160,
        grid: { color: '#eef1f4' },
        ticks: { color: '#9aa4b2', font: { size: 11 }, stepSize: 40 }
      }
    }
  }
});

// ============ Mobile nav toggle (if a hamburger is added) ============
const brandCollapse = document.querySelector('.brand-collapse');
if (brandCollapse) {
  brandCollapse.addEventListener('click', () => {
    document.querySelector('.app').classList.toggle('nav-open');
  });
}
