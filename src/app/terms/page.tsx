import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '이용약관 | Tennis Tab',
  description: 'Tennis Tab 서비스 이용약관',
}

export default function TermsPage() {
  return (
    <div style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-[1920px] mx-auto px-6 py-16">
        {/* 헤더 */}
        <div className="mb-12">
          <h1
            className="text-3xl font-display font-black mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            이용약관
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            시행일: 2025년 01월 01일 &nbsp;·&nbsp; 버전 1.0
          </p>
        </div>

        <div className="space-y-10 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>

          {/* 제1장 */}
          <section>
            <h2 className="text-lg font-display font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              제1장 총칙
            </h2>

            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  제1조 (목적)
                </h3>
                <p>
                  본 약관은 Tennis Tab(이하 "서비스")이 제공하는 테니스 대회 관리 플랫폼의
                  이용자가 서비스를 이용함에 있어 필요한 제반 사항과 상호간의 권리, 의무,
                  책임사항을 규정함을 목적으로 합니다.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  제2조 (용어의 정의)
                </h3>
                <ul className="space-y-1.5 pl-4">
                  <li>① <strong style={{ color: 'var(--text-primary)' }}>Tennis Tab</strong>: 운영자가 제공하는 테니스 대회 관리, 클럽 운영, 커뮤니티 서비스 플랫폼</li>
                  <li>② <strong style={{ color: 'var(--text-primary)' }}>운영자</strong>: Tennis Tab 서비스를 기획, 개발, 운영하는 주체</li>
                  <li>③ <strong style={{ color: 'var(--text-primary)' }}>회원</strong>: 약관에 동의하고 서비스 이용 계약을 체결한 자</li>
                  <li>④ <strong style={{ color: 'var(--text-primary)' }}>대회 주최자</strong>: 서비스를 통해 테니스 대회를 생성·관리하는 회원</li>
                  <li>⑤ <strong style={{ color: 'var(--text-primary)' }}>참가자</strong>: 대회에 참가 신청한 회원</li>
                  <li>⑥ <strong style={{ color: 'var(--text-primary)' }}>클럽</strong>: 서비스 내에서 회원들이 구성하는 테니스 모임 단위</li>
                  <li>⑦ <strong style={{ color: 'var(--text-primary)' }}>게시물</strong>: 회원이 서비스에 등록한 글, 사진, 댓글, 링크 등 일체의 정보</li>
                  <li>⑧ <strong style={{ color: 'var(--text-primary)' }}>아이디(ID)</strong>: 회원 식별을 위한 이메일 계정</li>
                </ul>
                <p className="mt-2">② 이 약관에서 사용하는 용어의 정의는 전항에서 정한 것을 제외하고는 관계 법령 및 서비스별 안내에서 정하는 바에 따릅니다.</p>
              </div>

              <div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  제3조 (약관의 효력 및 변경)
                </h3>
                <ul className="space-y-1.5 pl-4">
                  <li>① 본 약관은 서비스를 이용하는 모든 회원에 대해 효력이 발생합니다.</li>
                  <li>② 회원이 서비스에 가입하거나 서비스를 이용함으로써 본 약관에 동의한 것으로 간주됩니다.</li>
                  <li>③ 약관에 동의하지 않는 경우 서비스의 회원 가입 및 이용이 제한될 수 있습니다.</li>
                  <li>④ 운영자는 필요한 경우 약관을 변경할 수 있으며, 변경 시 적용일자 및 변경 사유를 명시하여 시행일 15일 전 서비스 내 공지합니다. 단, 회원에게 불리한 변경은 30일 전 공지합니다.</li>
                  <li>⑤ 회원이 변경된 약관의 적용일까지 거부 의사를 표시하지 않으면 동의한 것으로 간주됩니다. 동의하지 않는 경우 이용계약을 해지할 수 있습니다.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  제4조 (약관 외 준칙)
                </h3>
                <p>
                  이 약관에서 정하지 아니한 사항과 이 약관의 해석에 관하여는 「전기통신기본법」,
                  「전기통신사업법」, 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」,
                  「개인정보 보호법」 등 관련 법령 및 운영자가 정한 서비스 운영 정책에 따릅니다.
                </p>
              </div>
            </div>
          </section>

          {/* 제2장 */}
          <section>
            <h2 className="text-lg font-display font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              제2장 이용 계약
            </h2>

            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  제5조 (이용 계약의 성립)
                </h3>
                <ul className="space-y-1.5 pl-4">
                  <li>① 이용 계약은 신청자가 서비스 약관에 동의하고 필요 항목을 입력하여 가입을 완료한 시점에 성립합니다.</li>
                  <li>② 운영자는 이메일 인증, 소셜 로그인(Google, Kakao 등) 방식으로 본인 확인을 요청할 수 있습니다.</li>
                  <li>③ 만 14세 미만의 아동은 법정대리인의 동의 없이 서비스에 가입할 수 없습니다.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  제6조 (가입 신청의 승낙과 제한)
                </h3>
                <p className="mb-2">① 운영자는 다음 각 호에 해당하는 가입 신청에 대해 승낙을 거부하거나 사후에 이용계약을 해지할 수 있습니다.</p>
                <ul className="space-y-1.5 pl-4">
                  <li>1. 실명이 아니거나 타인의 명의를 이용한 경우</li>
                  <li>2. 허위 정보를 기재하거나 필수 항목을 누락한 경우</li>
                  <li>3. 이전에 약관 위반으로 이용계약이 해지된 경우</li>
                  <li>4. 관련 법령 또는 이 약관을 위반하는 목적으로 신청한 경우</li>
                  <li>5. 기타 운영자가 합리적인 이유로 승낙이 곤란하다고 판단하는 경우</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  제7조 (회원 정보 관리)
                </h3>
                <ul className="space-y-1.5 pl-4">
                  <li>① 회원은 서비스 내에서 언제든지 자신의 정보를 열람하고 수정할 수 있습니다.</li>
                  <li>② 회원 정보가 변경된 경우 서비스 내에서 수정해야 하며, 미수정으로 인한 불이익의 책임은 회원에게 있습니다.</li>
                  <li>③ 회원은 언제든지 서비스 내 탈퇴 기능을 통해 이용계약을 해지할 수 있습니다.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  제8조 (서비스 변경 및 중단)
                </h3>
                <ul className="space-y-1.5 pl-4">
                  <li>① 운영자는 합리적인 판단에 따라 서비스의 내용, 기능을 변경할 수 있으며, 변경 15일 전 공지합니다.</li>
                  <li>② 다음 각 호의 경우 서비스를 일시 중단하거나 종료할 수 있습니다.</li>
                  <ul className="space-y-1 pl-4 mt-1">
                    <li>1. 서버 점검, 교체, 장애 수리 등 기술적 사유</li>
                    <li>2. 천재지변, 국가비상사태 등 불가항력적 사유</li>
                    <li>3. 서비스 운영·유지가 불가능한 경우</li>
                  </ul>
                  <li>③ 1년 이상 서비스 이용 이력이 없는 회원에게 의사를 확인하고, 응답이 없는 경우 이용계약을 해지할 수 있습니다.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 제3장 */}
          <section>
            <h2 className="text-lg font-display font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              제3장 계약 당사자의 의무
            </h2>

            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  제9조 (운영자의 의무)
                </h3>
                <ul className="space-y-1.5 pl-4">
                  <li>① 운영자는 수집한 개인정보를 본인의 동의 없이 제3자에게 제공하지 않습니다. 단, 법령에 따른 적법한 요청이 있는 경우는 예외로 합니다.</li>
                  <li>② 회원의 불만 또는 민원을 접수하면 신속하게 처리하며, 즉시 처리가 어려운 경우 처리 일정을 안내합니다.</li>
                  <li>③ 운영자는 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」, 「개인정보 보호법」 등 관련 법령을 준수합니다.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  제10조 (회원의 의무)
                </h3>
                <p className="mb-2">① 회원은 다음 각 호의 행위를 해서는 안 됩니다.</p>
                <ul className="space-y-1.5 pl-4">
                  <li>1. 비정상적인 방법으로 서비스에 접근하거나 시스템을 조작하는 행위</li>
                  <li>2. 타인의 명의, 계정 정보를 도용하거나 운영자를 사칭하는 행위</li>
                  <li>3. 타인의 개인정보를 무단으로 수집, 저장, 공개하는 행위</li>
                  <li>4. 이벤트 혜택 등을 부정하게 취득할 목적으로 반복 가입·탈퇴하는 행위</li>
                  <li>5. 대회 경기 기록, 참가 정보 등을 허위로 입력하거나 조작하는 행위</li>
                  <li>6. 서비스의 정상적인 운영을 방해하거나 서버에 과부하를 야기하는 행위</li>
                  <li>7. 관련 법령 또는 이 약관을 위반하는 행위</li>
                </ul>
                <p className="mt-2">② 회원이 제1항을 위반한 경우 운영자는 서비스 이용 제한, 이용계약 해지, 손해배상 청구 등의 조치를 취할 수 있습니다.</p>
              </div>

              <div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  제11조 (계정 보안 의무)
                </h3>
                <p>
                  회원은 자신의 아이디와 비밀번호를 철저히 관리해야 합니다. 관리 소홀이나
                  부정 사용으로 발생하는 모든 결과의 책임은 회원에게 있습니다. 계정 도용이나
                  무단 사용을 인지한 경우 즉시 운영자에게 통보하고 안내에 따라야 합니다.
                </p>
              </div>
            </div>
          </section>

          {/* 제4장 */}
          <section>
            <h2 className="text-lg font-display font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              제4장 서비스 운용
            </h2>

            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  제12조 (서비스 이용 제한)
                </h3>
                <ul className="space-y-1.5 pl-4">
                  <li>① 회원이 이 약관을 위반하거나 서비스의 정상적인 운영을 방해한 경우, 운영자는 사전 통지 후 서비스 이용을 제한할 수 있습니다.</li>
                  <li>② 대회 기록, 경기 결과가 허위로 의심되는 경우, 운영자는 해당 내용의 공개를 중단하고 기능의 일부 또는 전부를 제한할 수 있습니다.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  제13조 (게시물 관리)
                </h3>
                <p className="mb-2">① 운영자는 다음 각 호에 해당하는 게시물을 사전 통지 없이 삭제할 수 있습니다.</p>
                <ul className="space-y-1.5 pl-4">
                  <li>1. 다른 회원 또는 제3자의 명예를 훼손하거나 개인정보를 침해하는 내용</li>
                  <li>2. 공공질서 및 미풍양속에 반하는 내용</li>
                  <li>3. 범죄와 관련된 내용 또는 불법 정보</li>
                  <li>4. 운영자 또는 제3자의 저작권, 상표권 등 지식재산권을 침해하는 내용</li>
                  <li>5. 허가되지 않은 광고, 홍보 목적의 내용</li>
                  <li>6. 관련 법령 또는 운영 정책에 위반되는 내용</li>
                </ul>
                <p className="mt-2">② 회원이 작성한 게시물의 저작권은 해당 회원에게 있으며, 운영자는 서비스 운영, 홍보 등의 목적으로 게시물을 활용할 수 있습니다.</p>
              </div>
            </div>
          </section>

          {/* 제5장 */}
          <section>
            <h2 className="text-lg font-display font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              제5장 손해배상 및 면책
            </h2>

            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  제14조 (손해배상)
                </h3>
                <ul className="space-y-1.5 pl-4">
                  <li>① 운영자의 고의 또는 과실로 회원에게 손해가 발생한 경우, 관련 법령이 규율하는 범위 내에서 손해를 배상합니다.</li>
                  <li>② 회원이 이 약관 또는 관련 법령을 위반하여 운영자에게 손해를 발생시킨 경우 이를 배상해야 합니다.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  제15조 (면책사항)
                </h3>
                <ul className="space-y-1.5 pl-4">
                  <li>① 운영자의 고의 또는 중과실 없이 발생한 서비스 장애, 데이터 손실 등에 대해 책임을 부담하지 않습니다.</li>
                  <li>② 천재지변, 전쟁, 테러 등 불가항력적 사유로 서비스를 제공할 수 없는 경우 책임이 면제됩니다.</li>
                  <li>③ 회원의 귀책사유로 인한 서비스 이용 장애에 대해 책임을 지지 않습니다.</li>
                  <li>④ 회원 간 또는 회원과 제3자 간에 서비스를 매개로 발생한 분쟁에 대해 운영자는 개입할 의무가 없으며 손해를 배상할 책임이 없습니다.</li>
                  <li>⑤ 서비스를 통해 제공되는 대회 정보, 경기 결과 등의 정확성에 대해 운영자는 보증하지 않으며, 이로 인한 손해에 대해 책임지지 않습니다.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 제6장 */}
          <section>
            <h2 className="text-lg font-display font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              제6장 준거법 및 관할
            </h2>

            <div>
              <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                제16조 (관할법원)
              </h3>
              <ul className="space-y-1.5 pl-4">
                <li>① 이 약관 및 서비스와 관련한 소송은 대한민국 법을 준거법으로 합니다.</li>
                <li>② 서비스 이용과 관련하여 분쟁이 발생한 경우, 운영자와 회원은 분쟁 해결을 위해 성실히 협의합니다.</li>
                <li>③ 협의에도 분쟁이 해결되지 않는 경우, 서울중앙지방법원을 제1심 관할법원으로 합니다.</li>
              </ul>
            </div>
          </section>

          {/* 부칙 */}
          <div
            className="pt-6 mt-6 border-t"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
          >
            <p>본 약관은 2025년 1월 1일부터 시행됩니다.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
