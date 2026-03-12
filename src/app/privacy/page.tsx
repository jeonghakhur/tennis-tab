import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '개인정보처리방침 | 마포구테니스협회',
  description: '마포구테니스협회 개인정보처리방침',
}

export default function PrivacyPage() {
  return (
    <div style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-[1920px] mx-auto px-6 py-16">
        {/* 헤더 */}
        <div className="mb-12">
          <h1
            className="text-3xl font-display font-black mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            개인정보처리방침
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            시행일: 2025년 01월 01일
          </p>
        </div>

        <div className="space-y-10 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>

          {/* 도입문 */}
          <p>
            마포구테니스협회(이하 "서비스")은 「개인정보 보호법」 등 관련 법령에 따라 이용자의
            개인정보를 보호하고, 관련 고충을 신속하고 원활하게 처리할 수 있도록 다음과 같이
            개인정보처리방침을 수립·공개합니다.
          </p>

          {/* 제1조 */}
          <section>
            <h2 className="text-base font-display font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              제1조 (개인정보의 처리 목적)
            </h2>
            <p className="mb-3">서비스는 다음의 목적을 위해 개인정보를 처리합니다. 처리한 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경될 경우 별도 동의를 받는 등 필요한 조치를 이행합니다.</p>
            <ul className="space-y-3 pl-4">
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>1. 회원 가입 및 관리</strong>
                <br />본인 식별·인증, 회원자격 유지·관리, 부정이용 방지, 각종 고지·통지
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>2. 대회 서비스 제공</strong>
                <br />대회 참가 신청 처리, 대진표 생성, 경기 결과 관리, 대회 주최자에게 참가자 정보 제공
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>3. 클럽 서비스 제공</strong>
                <br />클럽 가입·관리, 클럽 회원 정보 조회 및 역할 관리
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>4. 커뮤니티 서비스 제공</strong>
                <br />게시물 작성·열람, 댓글, 서비스 이용 현황 파악
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>5. 고객 지원</strong>
                <br />1:1 문의 접수 및 처리, 불만 처리, 분쟁 조정
              </li>
            </ul>
          </section>

          {/* 제2조 */}
          <section>
            <h2 className="text-base font-display font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              제2조 (처리하는 개인정보의 항목)
            </h2>
            <div className="space-y-4">
              <div>
                <p className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>1. 회원 가입 시 수집 항목</p>
                <ul className="space-y-1 pl-4">
                  <li><strong style={{ color: 'var(--text-primary)' }}>필수</strong>: 이메일 주소, 이름(닉네임)</li>
                  <li><strong style={{ color: 'var(--text-primary)' }}>선택</strong>: 전화번호, 출생연도, 성별, 프로필 사진</li>
                </ul>
              </div>
              <div>
                <p className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>2. 소셜 로그인 이용 시</p>
                <ul className="space-y-1 pl-4">
                  <li>Google 로그인: 이메일, 이름, 프로필 사진 (Google 제공 정보)</li>
                  <li>Kakao 로그인: 이메일, 닉네임, 프로필 사진 (Kakao 제공 정보)</li>
                </ul>
              </div>
              <div>
                <p className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>3. 대회 참가 신청 시</p>
                <ul className="space-y-1 pl-4">
                  <li><strong style={{ color: 'var(--text-primary)' }}>필수</strong>: 이름, 전화번호, 소속 클럽(선택적)</li>
                  <li><strong style={{ color: 'var(--text-primary)' }}>선택</strong>: 파트너 정보(복식 대회 시), 팀 정보(단체전 대회 시)</li>
                </ul>
              </div>
              <div>
                <p className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>4. 서비스 이용 과정에서 자동 생성·수집</p>
                <ul className="space-y-1 pl-4">
                  <li>서비스 이용 기록, 접속 로그, 쿠키, 접속 IP 주소</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 제3조 */}
          <section>
            <h2 className="text-base font-display font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              제3조 (개인정보의 처리 및 보유 기간)
            </h2>
            <p className="mb-3">서비스는 법령에 따른 개인정보 보유·이용 기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용 기간 내에서 개인정보를 처리·보유합니다.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse" style={{ borderColor: 'var(--border-color)' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                    <th className="border px-3 py-2 text-left font-semibold" style={{ borderColor: 'var(--border-color)' }}>목적</th>
                    <th className="border px-3 py-2 text-left font-semibold" style={{ borderColor: 'var(--border-color)' }}>보유 기간</th>
                    <th className="border px-3 py-2 text-left font-semibold" style={{ borderColor: 'var(--border-color)' }}>근거</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border px-3 py-2" style={{ borderColor: 'var(--border-color)' }}>회원 가입 및 관리</td>
                    <td className="border px-3 py-2" style={{ borderColor: 'var(--border-color)' }}>회원 탈퇴 시까지</td>
                    <td className="border px-3 py-2" style={{ borderColor: 'var(--border-color)' }}>이용자 동의</td>
                  </tr>
                  <tr style={{ backgroundColor: 'var(--bg-card)' }}>
                    <td className="border px-3 py-2" style={{ borderColor: 'var(--border-color)' }}>대회 참가 기록</td>
                    <td className="border px-3 py-2" style={{ borderColor: 'var(--border-color)' }}>대회 종료 후 3년</td>
                    <td className="border px-3 py-2" style={{ borderColor: 'var(--border-color)' }}>이용자 동의</td>
                  </tr>
                  <tr>
                    <td className="border px-3 py-2" style={{ borderColor: 'var(--border-color)' }}>고객 문의 기록</td>
                    <td className="border px-3 py-2" style={{ borderColor: 'var(--border-color)' }}>처리 완료 후 3년</td>
                    <td className="border px-3 py-2" style={{ borderColor: 'var(--border-color)' }}>이용자 동의</td>
                  </tr>
                  <tr style={{ backgroundColor: 'var(--bg-card)' }}>
                    <td className="border px-3 py-2" style={{ borderColor: 'var(--border-color)' }}>소비자 불만·분쟁 처리 기록</td>
                    <td className="border px-3 py-2" style={{ borderColor: 'var(--border-color)' }}>3년</td>
                    <td className="border px-3 py-2" style={{ borderColor: 'var(--border-color)' }}>전자상거래법</td>
                  </tr>
                  <tr>
                    <td className="border px-3 py-2" style={{ borderColor: 'var(--border-color)' }}>접속 로그 기록</td>
                    <td className="border px-3 py-2" style={{ borderColor: 'var(--border-color)' }}>3개월</td>
                    <td className="border px-3 py-2" style={{ borderColor: 'var(--border-color)' }}>통신비밀보호법</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 제4조 */}
          <section>
            <h2 className="text-base font-display font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              제4조 (개인정보의 제3자 제공)
            </h2>
            <p className="mb-3">서비스는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다음의 경우에만 예외적으로 제공합니다.</p>
            <ul className="space-y-2 pl-4">
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>대회 주최자에게 참가자 정보 제공</strong>
                <ul className="pl-4 mt-1 space-y-1">
                  <li>제공 대상: 해당 대회의 주최자(회원)</li>
                  <li>제공 항목: 이름, 전화번호, 소속 클럽</li>
                  <li>제공 목적: 대회 운영 및 참가자 확인</li>
                  <li>보유 기간: 대회 종료 후 즉시 파기 권고</li>
                </ul>
              </li>
              <li>법령의 규정에 의하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관이 요구하는 경우</li>
            </ul>
          </section>

          {/* 제5조 */}
          <section>
            <h2 className="text-base font-display font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              제5조 (개인정보처리 위탁)
            </h2>
            <p className="mb-3">서비스는 원활한 서비스 제공을 위해 다음과 같이 개인정보 처리업무를 위탁하고 있습니다.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                    <th className="border px-3 py-2 text-left font-semibold" style={{ borderColor: 'var(--border-color)' }}>수탁 업체</th>
                    <th className="border px-3 py-2 text-left font-semibold" style={{ borderColor: 'var(--border-color)' }}>위탁 업무</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border px-3 py-2" style={{ borderColor: 'var(--border-color)' }}>Supabase Inc.</td>
                    <td className="border px-3 py-2" style={{ borderColor: 'var(--border-color)' }}>회원 인증 및 데이터베이스 관리</td>
                  </tr>
                  <tr style={{ backgroundColor: 'var(--bg-card)' }}>
                    <td className="border px-3 py-2" style={{ borderColor: 'var(--border-color)' }}>Google LLC</td>
                    <td className="border px-3 py-2" style={{ borderColor: 'var(--border-color)' }}>소셜 로그인(Google OAuth), 클라우드 인프라</td>
                  </tr>
                  <tr>
                    <td className="border px-3 py-2" style={{ borderColor: 'var(--border-color)' }}>Vercel Inc.</td>
                    <td className="border px-3 py-2" style={{ borderColor: 'var(--border-color)' }}>서비스 호스팅 및 배포</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              수탁 업체가 추가되거나 변경될 경우 본 방침을 통해 공개합니다.
            </p>
          </section>

          {/* 제6조 */}
          <section>
            <h2 className="text-base font-display font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              제6조 (개인정보의 파기)
            </h2>
            <p className="mb-3">서비스는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체없이 해당 개인정보를 파기합니다.</p>
            <ul className="space-y-2 pl-4">
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>전자적 파일</strong>: 복구 및 재생이 불가능한 방법으로 영구 삭제
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>종이 문서</strong>: 분쇄 또는 소각
              </li>
            </ul>
            <p className="mt-3">
              단, 법령에 따라 보존해야 하는 정보는 별도 데이터베이스로 분리하여 해당 보존 기간 동안 보관합니다.
            </p>
          </section>

          {/* 제7조 */}
          <section>
            <h2 className="text-base font-display font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              제7조 (정보주체의 권리·의무 및 행사 방법)
            </h2>
            <p className="mb-3">이용자는 개인정보주체로서 다음과 같은 권리를 행사할 수 있습니다.</p>
            <ul className="space-y-1.5 pl-4">
              <li>① 개인정보 열람 요구</li>
              <li>② 오류 등이 있을 경우 정정 요구</li>
              <li>③ 삭제 요구</li>
              <li>④ 처리 정지 요구</li>
            </ul>
            <p className="mt-3">
              위 권리 행사는 서비스 내 &apos;내 정보&apos; 메뉴 또는 아래 개인정보 보호책임자에게 이메일, 서면 등으로 요청할 수 있으며,
              서비스는 이에 대해 지체없이 조치합니다.
            </p>
            <p className="mt-2">
              이용자는 권리 행사 시 「개인정보 보호법」 제35조 제4항, 제37조 제2항 등에 의해 해당 권리가 제한될 수 있습니다.
            </p>
          </section>

          {/* 제8조 */}
          <section>
            <h2 className="text-base font-display font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              제8조 (개인정보의 안전성 확보조치)
            </h2>
            <p className="mb-3">서비스는 개인정보의 안전성 확보를 위해 다음의 조치를 취합니다.</p>
            <ul className="space-y-2 pl-4">
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>1. 비밀번호 암호화</strong>
                <br />비밀번호는 암호화하여 저장·관리되며, 본인만 알 수 있습니다.
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>2. 전송 구간 암호화</strong>
                <br />HTTPS(TLS)를 통해 개인정보의 전송 구간을 암호화합니다.
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>3. 접근 권한 관리</strong>
                <br />개인정보 처리 시스템에 대한 접근 권한을 업무 수행에 필요한 최소한으로 제한합니다.
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>4. 접속 기록 관리</strong>
                <br />개인정보 처리 시스템 접속 기록을 보관·관리합니다.
              </li>
            </ul>
          </section>

          {/* 제9조 */}
          <section>
            <h2 className="text-base font-display font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              제9조 (쿠키의 설치·운영 및 거부)
            </h2>
            <ul className="space-y-2 pl-4">
              <li>① 서비스는 이용자에게 개별화된 서비스를 제공하기 위해 쿠키(cookie)를 사용합니다.</li>
              <li>② 쿠키는 웹사이트를 운영하는 데 이용되는 서버(http)가 이용자의 컴퓨터 브라우저에 보내는 소량의 정보이며, 이용자 디바이스에 저장됩니다.</li>
              <li>③ 이용자는 웹 브라우저 설정에서 쿠키 허용을 거부할 수 있습니다. 단, 쿠키 저장을 거부할 경우 일부 서비스 이용이 어려울 수 있습니다.</li>
            </ul>
          </section>

          {/* 제10조 */}
          <section>
            <h2 className="text-base font-display font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              제10조 (개인정보 보호책임자)
            </h2>
            <p className="mb-3">
              서비스는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한
              이용자의 불만 처리 및 피해구제 등을 위해 아래와 같이 개인정보 보호책임자를 지정합니다.
            </p>
            <div
              className="rounded-lg p-4 text-sm space-y-1"
              style={{ backgroundColor: 'var(--bg-card)' }}
            >
              <p><strong style={{ color: 'var(--text-primary)' }}>개인정보 보호 담당</strong></p>
              <p>서비스명: 마포구테니스협회</p>
              <p>연락처: support@tennis-tab.com</p>
            </div>
            <p className="mt-3">
              이용자는 서비스 이용 중 발생하는 모든 개인정보 보호 관련 문의, 불만 처리, 피해구제 등에 관한 사항을 위 담당자에게 문의하실 수 있습니다.
            </p>
          </section>

          {/* 제11조 */}
          <section>
            <h2 className="text-base font-display font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              제11조 (권익 침해 구제 방법)
            </h2>
            <p className="mb-3">
              이용자는 아래의 기관에 개인정보 침해에 대한 피해구제, 상담 등을 문의할 수 있습니다.
            </p>
            <ul className="space-y-3 pl-4">
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>개인정보분쟁조정위원회</strong>
                <br />전화: 1833-6972 &nbsp;|&nbsp; 웹사이트: www.kopico.go.kr
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>개인정보침해신고센터</strong>
                <br />전화: 118 &nbsp;|&nbsp; 웹사이트: privacy.kisa.or.kr
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>대검찰청 사이버범죄신고</strong>
                <br />전화: 1301 &nbsp;|&nbsp; 웹사이트: www.spo.go.kr
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>경찰청 사이버안전국</strong>
                <br />전화: 182 &nbsp;|&nbsp; 웹사이트: ecrm.cyber.go.kr
              </li>
            </ul>
          </section>

          {/* 제12조 */}
          <section>
            <h2 className="text-base font-display font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              제12조 (개인정보처리방침의 변경)
            </h2>
            <p>
              이 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경 내용의 추가,
              삭제 및 정정이 있는 경우에는 변경 사항의 시행 7일 전부터 서비스 공지사항을 통해 고지합니다.
            </p>
          </section>

          {/* 부칙 */}
          <div
            className="pt-6 mt-6 border-t"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
          >
            <p>본 개인정보처리방침은 2025년 1월 1일부터 시행됩니다.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
