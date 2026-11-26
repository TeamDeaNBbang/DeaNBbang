const notifications = require('../repositories/notification.repository');
const mail = require('./email.service');
let running = false;

async function deliverPending() {
    if (running) return;
    running = true;
    try {
        for (let i = 0; i < 10; i++) {
            const job = notifications.claimNext();
            if (!job) break;
            try {
                await mail.sendDeletionNotice(job);
            } catch {
                notifications.scheduleRetry(job.id, job.attempts);
                console.error('Deletion email failed', { notificationId: job.id, attempt: job.attempts });
                continue;
            }
            notifications.markSent(job.id, job.attempts);
        }
    } finally {
        running = false;
    }
}

module.exports = { deliverPending };
