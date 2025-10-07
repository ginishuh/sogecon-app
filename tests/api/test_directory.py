from __future__ import annotations

from http import HTTPStatus

from fastapi.testclient import TestClient


def test_directory_filters(admin_login: TestClient) -> None:
    client = admin_login
    # seed two members via admin create
    r1 = client.post('/members/', json={
        'email': 'alice@example.com', 'name': 'Alice', 'cohort': 1, 'major': 'CS'
    })
    r2 = client.post(
        '/members/',
        json={'email': 'bob@example.com', 'name': 'Bob', 'cohort': 2, 'major': 'Math'},
    )
    assert r1.status_code == HTTPStatus.CREATED and r2.status_code == HTTPStatus.CREATED

    # filter by cohort
    q1 = client.get('/members/?cohort=1')
    assert q1.status_code == HTTPStatus.OK
    data1 = q1.json()
    assert isinstance(data1, list)
    assert any(x['email']=='alice@example.com' for x in data1)
    assert all(x['cohort']==1 for x in data1)

    # search by q
    q2 = client.get('/members/?q=bo')
    assert q2.status_code == HTTPStatus.OK
    data2 = q2.json()
    assert any(x['email']=='bob@example.com' for x in data2)

    # filter by major
    q3 = client.get('/members/?major=cs')
    assert q3.status_code == HTTPStatus.OK
    data3 = q3.json()
    assert any(x['email']=='alice@example.com' for x in data3)

    # pagination: limit/offset
    p1 = client.get('/members/?limit=1&offset=0')
    p2 = client.get('/members/?limit=1&offset=1')
    assert p1.status_code == HTTPStatus.OK and p2.status_code == HTTPStatus.OK
    d1, d2 = p1.json(), p2.json()
    assert isinstance(d1, list) and isinstance(d2, list)
    assert d1 and d2 and d1[0]['email'] != d2[0]['email']

    # count endpoint
    c = client.get('/members/count?q=bo')
    assert c.status_code == HTTPStatus.OK
    assert c.json().get('count', 0) >= 1
