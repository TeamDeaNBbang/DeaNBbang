let viewerRequest;

export async function api(path, method = 'GET', body) {
    const options = { method, credentials: 'same-origin' };
    if (body instanceof FormData) {
        options.body = body;
    } else if (body !== undefined) {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(body);
    }

    let response;
    try {
        response = await fetch(path, options);
    } catch {
        throw new Error('서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
        const fields = data?.fieldErrors && Object.values(data.fieldErrors).join(' ');
        const error = new Error(fields || data?.message || '요청을 처리하지 못했어요.');
        error.status = response.status;
        error.code = data?.code;
        throw error;
    }
    return data;
}

export function viewer() {
    viewerRequest ??= api('/api/auth/me').catch(error => {
        if (error.status === 401) return null;
        viewerRequest = undefined;
        throw error;
    });
    return viewerRequest;
}

export function writingPath(id) {
    return '/html/detail.html?id=' + encodeURIComponent(id);
}

export function won(amount) {
    return Number.isFinite(amount) ? amount.toLocaleString('ko-KR') + '원' : '미설정';
}

export function addWritingCards(container, writings) {
    container.replaceChildren();
    for (const writing of writings) {
        const card = document.createElement('article');
        card.className = 'post-card';
        const link = document.createElement('a');
        link.href = writingPath(writing.id);
        if (writing.photoUrl) {
            const photo = document.createElement('img');
            photo.src = writing.photoUrl;
            photo.alt = '';
            link.append(photo);
        } else {
            const fallback = document.createElement('span');
            fallback.className = 'no-photo';
            fallback.textContent = '등록된 사진 없음';
            link.append(fallback);
        }

        const summary = document.createElement('div');
        summary.className = 'summary';
        const title = document.createElement('h3');
        title.textContent = writing.title;
        summary.append(title);
        if (writing.recruitmentStatus) {
            const state = document.createElement('p');
            const count = writing.targetCount == null ? writing.participantCount + '명'
                : writing.participantCount + ' / ' + writing.targetCount + '명';
            state.textContent = (writing.recruitmentStatus === 'CLOSED' ? '모집 마감' : '모집 중') + ' · ' + count;
            const price = document.createElement('p');
            price.textContent = '현재 1인 ' + won(writing.pricePerPerson) + ' · 목표 달성 시 ' + won(writing.expectedPricePerPerson);
            summary.append(state, price);
        }
        link.append(summary);
        card.append(link);
        container.append(card);
    }
}
