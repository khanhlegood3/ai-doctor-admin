// src/i18n/aikolReportI18n.js
// Nội dung song ngữ (vi/en) của "Báo cáo tương tác AIKOL Network" (trang "AIKOL token").
// Cú pháp chữ trong chuỗi (xem <Rich /> trong AikolNetworkReport.jsx):
//   **đậm**   `mã`   //nghiêng//

const vi = {
  tabs: {
    overview: 'Tổng Quan Hệ Sinh Thái',
    viction: 'Viction Zero-Gas & ERC-6551',
    pumpfun: 'Pump.fun & Bonding Curve',
    sybil: 'Merkle & Anti-Sybil ML',
    engine: 'Quint-Engine & AI Pose',
    tunecore: 'TuneCore Splits Router',
    mica: 'Pháp Lý MiCA',
  },
  common: {
    simNote: 'Mô phỏng minh họa để giải thích cơ chế — không phải dữ liệu hay giá thị trường thực.',
    points: 'điểm',
    reportSite: 'hienmaunhanvan.com',
  },
  overview: {
    badge: 'Báo Cáo Nghiên Cứu Chuyên Sâu Web3 & Y Tế Cộng Đồng',
    title: 'Kiến Trúc Tích Hợp AIKOL Network, Viction Zero-Gas & Phễu Solana Cross-Chain',
    intro:
      'Phân tích toàn diện chiến lược dịch chuyển từ tài sản văn hóa/đầu cơ ngắn hạn trên Solana (`HMhtez1...Ppump`) sang hạ tầng giáo dục y tế bền vững, miễn phí giao dịch trên Viction EVM, tuân thủ Đạo luật MiCA Châu Âu.',
    metrics: [
      { icon: '🪙', label: 'Tổng Cung $ZoFo', value: '1,000,000,000', sub: 'Cố định - Không lạm phát' },
      { icon: '⚡', label: 'Hạ Tầng EVM Cốt Lõi', value: 'Viction Layer-1', sub: 'Chuẩn VRC-25 Zero-Gas Fee' },
      { icon: '🚀', label: 'Phễu Kéo Người Dùng', value: 'Solana Pump.fun', sub: 'Mô hình Đường cong giá 85 SOL' },
      { icon: '🔬', label: 'Chuẩn Xác Thực AI', value: 'Google MediaPipe', sub: '33 Khớp xương 3D Wasm Client' },
    ],
    modelTitle: 'Mô Hình Tổng Quan & Động Cơ Kinh Tế Tokenomics',
    modelText:
      'AIKOL Network tiên phong trong mô hình "Attention-First, Utility-Second". Dự án tận dụng động lượng đầu cơ từ hệ sinh thái Solana để xây dựng cộng đồng ban đầu, sau đó lọc danh tính thực thông qua thuật toán LightGBM và di trú sang nền tảng Viction Zero-Gas để vận hành cổng E-learning y tế.',
    chartTitle: 'Biểu Đồ Phân Bổ 1 Tỷ Token $ZoFo',
    detailTitle: 'Chi Tiết Phân Bổ Nguồn Quỹ',
    chartLabels: [
      'Sub-DAOs Dự Án (I2E)',
      'L2E & Proof-of-Action',
      'Đội Ngũ Sáng Lập',
      'Thanh Khoản DEX & Marketing',
      'TuneCore Splits & Oracles',
    ],
    funds: [
      { name: 'Quỹ Sub-DAOs Dự Án (35%)', desc: 'Tier 3: Impact-to-Earn (I2E) - Giải ngân qua Hospital Oracles', amount: '350M $ZoFo' },
      { name: 'Quỹ L2E & Proof-of-Action (30%)', desc: 'Tier 1 & Tier 2: Trả thưởng bài thi lý thuyết & POAP thực địa', amount: '300M $ZoFo' },
      { name: 'Đội Ngũ Sáng Lập & Thương Hiệu (15%)', desc: 'Cam kết dài hạn phát triển hệ thống và mở rộng thương hiệu', amount: '150M $ZoFo' },
      { name: 'Thanh Khoản DEX & Marketing (10%)', desc: 'Cung cấp thanh khoản ban đầu và phễu thu hút người dùng', amount: '100M $ZoFo' },
      { name: 'TuneCore Splits & Oracles (10%)', desc: 'Tier 4: Phí duy trì trạm Oracles và chia sẻ bản quyền tác giả', amount: '100M $ZoFo' },
    ],
  },
  viction: {
    eyebrow: 'Hạ Tầng Kỹ Thuật Bền Vững',
    title: 'Viction Zero-Gas EVM & Tài Khoản Gắn Két (ERC-6551)',
    intro:
      'Mục này giải mã cấu trúc hạ tầng cho phép AIKOL Network loại bỏ hoàn toàn chi phí phí gas cho học viên y tế và tình nguyện viên. Sự kết hợp giữa tiêu chuẩn VRC-25, VRC-725 và Tài khoản Gắn két Token (ERC-6551) tạo ra trải nghiệm sử dụng mượt mà như ứng dụng Web2 nhưng bảo mật theo chuẩn Web3.',
    cards: [
      {
        icon: '⚡',
        title: 'Tiêu Chuẩn VRC-25 & Zero-Gas Protocol',
        desc: 'Người dùng không cần nắm giữ VIC coin để làm phí giao dịch. Mọi chi phí được tài trợ thông qua hợp đồng tài trợ phí `VRC25Issuer`.',
        code: [
          '// Yêu cầu 3 Storage Slots:',
          'slot 0: _balances (address=>uint256)',
          'slot 1: _minFee (uint256)',
          'slot 2: _owner (address)',
        ],
        note: 'Yêu cầu Quỹ dự án duy trì nạp tối thiểu 10 VIC vào Hợp đồng Tài trợ.',
      },
      {
        icon: '📜',
        title: 'VRC-725 & Off-Chain Permit (IERC4494)',
        desc: 'Dùng để đúc các Chứng chỉ Y tế NFT không tốn phí. Tích hợp cơ chế ủy quyền chữ ký ngoài chuỗi không gas (`permit` và `permitForAll`).',
        code: ['// Chữ ký EIP-712 Off-chain:', 'permit(owner, spender, tokenId, deadline, signature)'],
        note: 'Giúp học viên nhận chứng chỉ năng lực y tế mà không cần ký giao dịch trên chuỗi.',
      },
      {
        icon: '🪪',
        title: 'ERC-6551 Token Bound Accounts (TBA)',
        desc: 'Hồ sơ NFT của tình nguyện viên tự động sở hữu 1 Ví Hợp đồng Thông minh riêng biệt. NFT trở thành một thực thể chủ động trên chuỗi.',
        code: [
          '// Khả năng lưu trữ tự động:',
          '• SBTs Kỹ năng y tế (ERC-5192)',
          '• Huy hiệu POAP hiện diện',
          '• Thưởng token $ZoFo tự động',
        ],
        note: 'Lịch sử và doanh thu gắn liền vĩnh viễn với NFT, kiểm toán công khai trên 9scan.',
      },
    ],
    flowTitle: 'Luồng Trải Nghiệm Người Dùng Không Gas (Zero-Gas Flow)',
    stepWord: 'Bước',
    steps: [
      { title: 'Học Viên Học Lý Thuyết', desc: 'Hoàn thành bài thi điểm ≥ 80% trên cổng Web2.' },
      { title: 'Tạo Chữ Ký Off-Chain', desc: 'Hệ thống tạo EIP-712 Permit Signature.' },
      { title: 'Issuer Tài Trợ Phí', desc: 'VRC25Issuer trích quỹ VIC thanh toán Gas Fee.' },
      { title: 'Đúc NFT & Ví ERC-6551', desc: 'Học viên nhận NFT + Ví TBA tự động tích hợp.' },
    ],
  },
  pumpfun: {
    eyebrow: 'Phễu Kéo Người Dùng Solana',
    title: 'Đường Cong Giá Pump.fun & Mô Phỏng Tốt Nghiệp Thanh Khoản',
    intro:
      'Phần này phân tích cơ chế toán học của hợp đồng promo token `{address}` trên nền tảng Pump.fun của Solana. Sử dụng thanh trượt bên dưới để mô phỏng sự tăng trưởng giá trị, thay đổi dự trữ ảo và điều kiện "tốt nghiệp" chuyển thanh khoản lên Raydium.',
    panelTitle: '🎛️ Bảng Điều Khiển Mô Phỏng',
    status: {
      launch: '🌱 Khởi Tạo Khối Lượng Ban Đầu',
      mid: '📈 Động Lượng Tiếp Cận',
      near: '🔥 Hoàn Thành Sắp Thoát Đường Cong',
      graduated: '🎉 Tốt Nghiệp (Graduated)',
    },
    sliderLabel: 'Lượng SOL Đã Nạp Vào Đường Cong:',
    marks: ['0 SOL (Launch)', '42.5 SOL (50%)', '85 SOL (Graduation)'],
    marketCap: 'Ước Tính Vốn Hóa Thị Trường:',
    tokenPrice: 'Giá Mỗi Token ($ZoFo):',
    virtualTokens: 'Dự Trữ Token Ảo Còn Lại (y):',
    lpLabel: 'Cơ Chế Khóa LP & Mint Authority:',
    lp: { unlocked: 'Chưa Khóa', unlockedNew: 'Chưa Khóa (Đang Mới)', burned: 'Đã Đốt LP & Chuyển Raydium' },
    note: '💡 **Ghi chú thực tế:** Chưa đến 2% token trên Pump.fun hoàn thành mốc 85 SOL để di trú lên Raydium. AIKOL Network sử dụng phễu này để thu hút sự chú ý trước khi lọc người dùng thật qua thuật toán Anti-Sybil.',
    chartTitle: 'Đường Cong Giá x · y = k Tự Động Theo Lượng SOL',
    chartDataset: 'Giá Token ($ZoFo / SOL)',
    tableHead: ['Giai Đoạn Hoạt Động', 'Ngưỡng Tích Lũy SOL', 'Đặc Điểm Cơ Chế Thị Trường Cốt Lõi'],
    rows: [
      ['Khởi Tạo (Launch)', '0 - 5 SOL', 'Định giá siêu thấp. Giai đoạn thường bị chi phối bởi sniper bots hoặc devs.'],
      ['Động Lượng Sớm', '5 - 25 SOL', 'Biến động giá mạnh (10x - 30x). Lan tỏa cộng đồng trên Twitter/X và Telegram.'],
      ['Tiếp Cận (Mid Curve)', '25 - 50 SOL', 'Thanh khoản dày dần. Pha trộn giữa dòng tiền thật và wash trading.'],
      ['Hoàn Thành Đường Cong', '50 - 85 SOL', 'Áp lực mua gia tăng do hiệu ứng FOMO chuẩn bị thoát khỏi đường cong ảo.'],
      ['Tốt Nghiệp (Graduation)', '~ 85 SOL', 'Di trú 79 SOL + 200M token tạo LP Raydium. Đốt LP tokens & thu hồi Mint Authority!'],
    ],
  },
  sybil: {
    eyebrow: 'Lọc Danh Tính & Kháng Gian Lận',
    title: 'Airdrop Cây Merkle & Thuật Toán Anti-Sybil (LightGBM)',
    intro:
      'Mục này chi tiết hóa giải pháp bảo vệ quỹ dự án khỏi các đợt tấn công cào airdrop (Sybil Attacks). AIKOL Network kết hợp thuật toán học máy phân cụm đồ thị (DBSCAN/OPTICS + LightGBM) với cấu trúc Bằng chứng Cây Merkle (Merkle Proof) để đảm bảo 100% token $ZoFo được trao cho người dùng thật.',
    checklistTitle: 'Kiểm Tra Tiêu Chí Đánh Giá Rủi Ro Sybil',
    checklistIntro: 'Tích chọn các đặc trưng hành vi của địa chỉ ví Solana để mô phỏng điểm đánh giá từ thuật toán LightGBM:',
    criteria: [
      { label: 'Cùng Nguồn Nạp Gas Đầu Tiên (Funding Source Cluster)', desc: 'Ví nhận SOL phí từ cùng 1 ví cá nhân/địa chỉ CEX phụ trong khoảng 10 phút.' },
      { label: 'Đồng Bộ Thời Gian Giao Dịch (Temporal Pattern)', desc: 'Thực hiện lệnh mua/bán trên Pump.fun với độ lệch thời gian < 3 giây.' },
      { label: 'Trùng Lặp WebGL / Canvas Fingerprint', desc: 'Nhiều địa chỉ tương tác từ cùng 1 chữ ký phần cứng phần mềm trình duyệt.' },
      { label: 'Có Lịch Sử Học E-Learning / Quét POAP (Tín hiệu tích cực)', desc: 'Địa chỉ từng hoàn thành bài kiểm tra y tế hoặc có chứng nhận W3C VC.' },
    ],
    scoreLabel: 'Xác Xuất Sybil (LightGBM Score):',
    verdictSafe: 'An Toàn',
    verdictRisk: 'Cảnh Báo Sybil High Risk',
    statusSafe: '✅ Ví hợp lệ! Được cấp Merkle Proof để nhận Airdrop $ZoFo trên Viction.',
    statusRisk: '❌ Phát hiện dấu hiệu Sybil! Địa chỉ bị thuật toán LightGBM gắn cờ loại khỏi danh sách Airdrop.',
    merkleTitle: 'Kiến Trúc Xác Minh Merkle Tree (Solidity & OpenZeppelin)',
    merkleIntro:
      'Thay vì lưu trữ danh sách hàng ngàn ví trên Smart Contract gây tốn kém tài nguyên, hệ thống chỉ lưu 1 chuỗi băm 32-byte duy nhất (`Merkle Root`) trên contract `AirDrop.sol`.',
    merkleComment: '// Mẫu kiểm tra Bằng chứng Merkle trong AirDrop.sol',
    bullets: [
      '**Kháng Double-Claim:** Mỗi địa chỉ hợp lệ chỉ được nhận thưởng đúng 1 lần vào tài khoản ERC-6551.',
      '**Bảo Mật Quyền Riêng Tư:** Tích hợp Bằng chứng Không Tiết Lộ Zero-Knowledge Proofs (ZKP) để xác minh người thật mà không cần thu thập hồ sơ KYC nhạy cảm.',
    ],
  },
  engine: {
    eyebrow: 'Xác Thực Năng Lực Đa Tầng',
    title: 'Bộ Máy Xác Thực 5 Lớp (Quint-Engine) & AI MediaPipe',
    intro:
      'Hệ thống đánh giá độ khả tín và năng lực y tế của tình nguyện viên bằng hàm toán học: `S_project = Σ (w_i × Score_i), i = 1…5`. Kéo các thanh trượt điểm số bên dưới để mô phỏng tổng điểm khả tín và quyền mở khóa danh hiệu Master Hero User.',
    slidersTitle: '🎛️ Nhập Điểm Số Thành Phần (0 - 100 điểm)',
    layers: [
      { name: 'Layer 1: IP Provenance', desc: 'Đối chiếu Perceptual Hash bài giảng qua IPFS/Arweave.' },
      { name: 'Layer 2: E-Learning VC', desc: 'Điểm kiểm tra trắc nghiệm lý thuyết (Yêu cầu ≥ 80%).' },
      { name: 'Layer 3: AI MediaPipe Pose', desc: 'Độ chính xác động tác thực hành (33 điểm mốc 3D Wasm).' },
      { name: 'Layer 4: Action / POAP', desc: 'Hiện diện vật lý (Quét QR động / NFC tại trạm hiến máu).' },
      { name: 'Layer 5: Outcome Impact', desc: 'Xác thực đầu ra từ Hospital Oracles (Dữ liệu máu nhập kho).' },
    ],
    totalLabel: 'Tổng Điểm Khả Tín (S_project)',
    badges: { master: 'Master Hero User', standard: 'Tình Nguyện Viên Đạt Chuẩn', below: 'Chưa Đạt Chuẩn Tối Thiểu' },
    descs: {
      master: '🎉 **Chúc mừng!** Đạt điều kiện trở thành Master Hero User. Được phép đúc bản Remix bài giảng và nhận 60% phân bổ doanh thu TuneCore Splits.',
      standard: '✅ Đạt chuẩn Tình nguyện viên thực địa. Được nhận thưởng $ZoFo từ quỹ L2E và Proof-of-Action.',
      below: '⚠️ Tổng điểm chưa đủ 70 điểm. Cần cải thiện điểm bài kiểm tra lý thuyết hoặc bài tập động tác AI MediaPipe.',
    },
    chartTitle: 'Trọng Số & Điểm Đạt Được Qua 5 Lớp',
    chartDataset: 'Điểm Nhập Vào',
  },
  tunecore: {
    eyebrow: 'Mô Hình Dòng Tiền Tự Bền Vững',
    title: 'Hợp Đồng TuneCore Splits Router & Tác Động Thực Tế',
    intro:
      'Khác với các dự án Web3 thuần đầu cơ, AIKOL Network tạo ra nguồn doanh thu thực tế từ việc phân phối giáo trình y tế. Sử dụng công cụ bên dưới để tính toán cách hợp đồng TuneCore Splits tự động phân bổ dòng tiền khi phát sinh giao dịch bán bản gốc hoặc bán thứ cấp (Secondary Remix).',
    calcTitle: '🧮 Máy Tính Phân Bổ Dòng Tiền',
    revenueLabel: 'Doanh Thu Tổng Phát Sinh ($):',
    streamLabel: 'Loại Hình Giao Dịch:',
    streams: {
      secondary: 'Bản Remix Thứ Cấp (Secondary Remix - Master Hero)',
      primary: 'Bản Gốc Ban Đầu (Primary Sale - Bác sĩ/KOL)',
      microsync: 'Bản Quyền Truyền Thông (Micro-Sync)',
    },
    shares: ['Chuyên Gia / Bác Sĩ Ban Đầu:', 'Master Hero (Người Sáng Tạo Remix):', 'Ngân Sách Quản Trị DAO:', 'Phí Oracles & AI Infrastructure:'],
    chartTitle: 'Trực Quan Hóa Tỷ Lệ Phân Bổ Dòng Tiền',
    chartCategory: 'Phân Bổ Doanh Thu ($)',
    datasets: ['Chuyên Gia / Bác Sĩ', 'Master Hero User', 'Quỹ DAO', 'Phí Oracles & AI'],
    casesTitle: '🏥 3 Kịch Bản Ứng Dụng Tác Động Xã Hội Thực Tế',
    cases: [
      {
        tag: '1. Cứu Trợ & Hiến Máu',
        title: 'Quy Trình L2E ➔ A2E ➔ I2E',
        desc: 'Tình nguyện viên học lý thuyết (L2E), luyện tập băng bó qua AI Camera, quét mã POAP tại hiện trường (A2E). Khi Oracle bệnh viện xác thực máu đã lưu kho, hợp đồng tự động giải ngân quỹ DAO (I2E).',
      },
      {
        tag: '2. Chăm Sóc Ung Thư',
        title: 'Quy Trình Remix Doanh Thu',
        desc: 'Bác sĩ đăng bài phác đồ gốc. Người nhà bệnh nhân đạt Master Hero bổ sung video thực tế và dịch sang tiếng bản địa. Khi bài Remix được bán, người nhà nhận 60% để trang trải viện phí, bác sĩ nhận 25% thụ động.',
      },
      {
        tag: '3. Tái Hòa Nhập Cộng Đồng',
        title: 'ZKP & Hồ Sơ Năng Lực Kháng Phân Biệt',
        desc: 'Người từng lầm lỡ học nghề y tế sơ cấp. Bằng chứng Bảo mật Zero-Knowledge Proofs (ZKP) giúp họ chứng minh trình độ chuyên môn với nhà tuyển dụng mà không tiết lộ tiền án tiền sự.',
      },
    ],
  },
  mica: {
    eyebrow: 'Khung Pháp Lý Liên Minh Châu Âu',
    title: 'Đạo Luật MiCA (Markets in Crypto-Assets - Article 4)',
    intro:
      'Phân tích tính hợp pháp và các điểm miễn trừ chiến lược giúp AIKOL Network vận hành đợt Airdrop cross-chain mà không vi phạm các quy định khắt khe của Liên minh Châu Âu (EU).',
    classTitle: '⚖️ Phân Loại Tài Sản Theo Điều 3(1)(9) MiCA',
    classLabel: 'Xác Định Phân Loại:',
    classValue: 'Utility Token',
    classText:
      '$ZoFo không phải là ART (Asset-Referenced Token) hay EMT (E-Money Token) do không neo giá vào tài sản pháp định. Mục đích cốt lõi là cung cấp quyền truy cập kỹ thuật số vào nền tảng E-learning và thanh toán phí bản quyền TuneCore.',
    exemptTitle: '📜 3 Điểm Miễn Trừ Xuất Bản Whitepaper (Article 4)',
    exemptions: [
      '**Phát hành Miễn phí (Offered for Free):** Airdrop cho người dùng Solana không yêu cầu trả tiền hoặc thu thập dữ liệu cá nhân.',
      '**Quy mô Chào bán < 1 Triệu EUR:** Tổng giá trị chào bán công khai tại EU trong 12 tháng không vượt ngưỡng 1,000,000 EUR.',
      '**Nền tảng đã vận hành:** Cổng E-learning hienmaunhanvan.com đã hoạt động thực tế, tách biệt khỏi các mô hình ICO hứa hẹn tương lai.',
    ],
    riskTitle: '⚠️ Rủi Ro Pháp Lý Hệ Trọng Cần Lưu Ý',
    riskText:
      'Các sự miễn trừ theo Điều 4 MiCA sẽ **mất hiệu lực ngay lập tức** nếu tổ chức phát hành công bố ý định xin niêm yết ($ZoFo) lên một sàn giao dịch được cấp phép tại EU (Trading Platform). Đây là lý do AIKOL Network tách biệt hoàn toàn vai trò: Token trên Solana là //Community Promo Token//, trong khi Token trên Viction là //Utility Token// tuân thủ nghiêm ngặt khung miễn trừ Airdrop Châu Âu.',
    legalNote: 'Nội dung mang tính tham khảo, không phải tư vấn pháp lý và không phải lời khuyên đầu tư.',
  },
  footer: ['© 2026 AIKOL Network (hienmaunhanvan.com). Báo Cáo Nghiên Cứu Chuyên Sâu Tương Tác.', 'Xây dựng trên Viction Zero-Gas EVM & Solana Cross-Chain Funnel.'],
}

const en = {
  tabs: {
    overview: 'Ecosystem Overview',
    viction: 'Viction Zero-Gas & ERC-6551',
    pumpfun: 'Pump.fun & Bonding Curve',
    sybil: 'Merkle & Anti-Sybil ML',
    engine: 'Quint-Engine & AI Pose',
    tunecore: 'TuneCore Splits Router',
    mica: 'MiCA Legal Framework',
  },
  common: {
    simNote: 'Illustrative simulation to explain the mechanics — not real market data or prices.',
    points: 'pts',
    reportSite: 'hienmaunhanvan.com',
  },
  overview: {
    badge: 'In-Depth Web3 & Community Health Research Report',
    title: 'Integrated Architecture of AIKOL Network, Viction Zero-Gas & the Solana Cross-Chain Funnel',
    intro:
      'A comprehensive analysis of the strategy of moving from a cultural / short-term speculative asset on Solana (`HMhtez1...Ppump`) to a sustainable, gas-free medical education infrastructure on Viction EVM, aligned with the EU MiCA regulation.',
    metrics: [
      { icon: '🪙', label: '$ZoFo Total Supply', value: '1,000,000,000', sub: 'Fixed - Non-inflationary' },
      { icon: '⚡', label: 'Core EVM Infrastructure', value: 'Viction Layer-1', sub: 'VRC-25 Zero-Gas Fee standard' },
      { icon: '🚀', label: 'User Acquisition Funnel', value: 'Solana Pump.fun', sub: '85 SOL bonding-curve model' },
      { icon: '🔬', label: 'AI Attestation Standard', value: 'Google MediaPipe', sub: '33 3D skeletal keypoints, Wasm client-side' },
    ],
    modelTitle: 'Overview Model & Tokenomics Economic Engine',
    modelText:
      'AIKOL Network pioneers an "Attention-First, Utility-Second" model. The project harnesses speculative momentum from the Solana ecosystem to build an initial community, then filters for real identities with a LightGBM algorithm and migrates to the Viction Zero-Gas platform to run the medical E-learning portal.',
    chartTitle: 'Allocation of the 1 Billion $ZoFo Supply',
    detailTitle: 'Fund Allocation Details',
    chartLabels: [
      'Project Sub-DAOs (I2E)',
      'L2E & Proof-of-Action',
      'Founding Team',
      'DEX Liquidity & Marketing',
      'TuneCore Splits & Oracles',
    ],
    funds: [
      { name: 'Project Sub-DAOs Fund (35%)', desc: 'Tier 3: Impact-to-Earn (I2E) - disbursed via Hospital Oracles', amount: '350M $ZoFo' },
      { name: 'L2E & Proof-of-Action Fund (30%)', desc: 'Tier 1 & Tier 2: Rewards for theory exams & on-site POAP', amount: '300M $ZoFo' },
      { name: 'Founding Team & Brand (15%)', desc: 'Long-term commitment to system development and brand expansion', amount: '150M $ZoFo' },
      { name: 'DEX Liquidity & Marketing (10%)', desc: 'Initial liquidity and the user-acquisition funnel', amount: '100M $ZoFo' },
      { name: 'TuneCore Splits & Oracles (10%)', desc: 'Tier 4: Oracle station upkeep fees and author-royalty sharing', amount: '100M $ZoFo' },
    ],
  },
  viction: {
    eyebrow: 'Sustainable Technical Infrastructure',
    title: 'Viction Zero-Gas EVM & Token Bound Accounts (ERC-6551)',
    intro:
      'This section explains the infrastructure that lets AIKOL Network remove gas fees entirely for medical learners and volunteers. Combining the VRC-25 and VRC-725 standards with Token Bound Accounts (ERC-6551) delivers a Web2-smooth experience with Web3-grade security.',
    cards: [
      {
        icon: '⚡',
        title: 'VRC-25 Standard & Zero-Gas Protocol',
        desc: 'Users do not need to hold VIC coin to pay transaction fees. All costs are sponsored through the `VRC25Issuer` fee-sponsoring contract.',
        code: [
          '// Requires 3 Storage Slots:',
          'slot 0: _balances (address=>uint256)',
          'slot 1: _minFee (uint256)',
          'slot 2: _owner (address)',
        ],
        note: 'The project fund must keep at least 10 VIC deposited in the sponsoring contract.',
      },
      {
        icon: '📜',
        title: 'VRC-725 & Off-Chain Permit (IERC4494)',
        desc: 'Used to mint Medical Certificate NFTs at no cost. Integrates a gasless off-chain signature authorization mechanism (`permit` and `permitForAll`).',
        code: ['// EIP-712 off-chain signature:', 'permit(owner, spender, tokenId, deadline, signature)'],
        note: 'Lets learners receive medical competency certificates without signing an on-chain transaction.',
      },
      {
        icon: '🪪',
        title: 'ERC-6551 Token Bound Accounts (TBA)',
        desc: "A volunteer's NFT profile automatically owns its own smart-contract wallet. The NFT becomes an active on-chain entity.",
        code: [
          '// Automatic storage capabilities:',
          '• Medical-skill SBTs (ERC-5192)',
          '• Attendance POAP badges',
          '• Automatic $ZoFo token rewards',
        ],
        note: 'History and revenue stay permanently tied to the NFT, publicly auditable on 9scan.',
      },
    ],
    flowTitle: 'Zero-Gas User Experience Flow',
    stepWord: 'Step',
    steps: [
      { title: 'Learner Studies Theory', desc: 'Completes an exam with a score ≥ 80% on the Web2 portal.' },
      { title: 'Create Off-Chain Signature', desc: 'The system generates an EIP-712 Permit Signature.' },
      { title: 'Issuer Sponsors the Fee', desc: 'VRC25Issuer draws from the VIC fund to pay the gas fee.' },
      { title: 'Mint NFT & ERC-6551 Wallet', desc: 'The learner receives the NFT plus an integrated TBA wallet.' },
    ],
  },
  pumpfun: {
    eyebrow: 'Solana User Acquisition Funnel',
    title: 'Pump.fun Bonding Curve & Liquidity Graduation Simulator',
    intro:
      'This section analyzes the mathematics of the promo token contract `{address}` on Solana\'s Pump.fun platform. Use the slider below to simulate value growth, changes in virtual reserves, and the "graduation" condition that moves liquidity to Raydium.',
    panelTitle: '🎛️ Simulation Control Panel',
    status: {
      launch: '🌱 Initial Launch Volume',
      mid: '📈 Mid-Curve Momentum',
      near: '🔥 Nearly Completing the Curve',
      graduated: '🎉 Graduated',
    },
    sliderLabel: 'SOL Deposited Into the Curve:',
    marks: ['0 SOL (Launch)', '42.5 SOL (50%)', '85 SOL (Graduation)'],
    marketCap: 'Estimated Market Cap:',
    tokenPrice: 'Price per Token ($ZoFo):',
    virtualTokens: 'Remaining Virtual Token Reserve (y):',
    lpLabel: 'LP Lock & Mint Authority:',
    lp: { unlocked: 'Not Locked', unlockedNew: 'Not Locked (New)', burned: 'LP Burned & Moved to Raydium' },
    note: '💡 **Reality check:** Fewer than 2% of tokens on Pump.fun reach the 85 SOL mark and migrate to Raydium. AIKOL Network uses this funnel to attract attention before filtering real users with the Anti-Sybil algorithm.',
    chartTitle: 'Price Curve x · y = k by Amount of SOL',
    chartDataset: 'Token Price ($ZoFo / SOL)',
    tableHead: ['Stage', 'Accumulated SOL Threshold', 'Core Market Mechanics'],
    rows: [
      ['Launch', '0 - 5 SOL', 'Ultra-low valuation. Typically dominated by sniper bots or devs.'],
      ['Early Momentum', '5 - 25 SOL', 'Sharp price swings (10x - 30x). Community spread on Twitter/X and Telegram.'],
      ['Mid Curve', '25 - 50 SOL', 'Liquidity gradually thickens. A mix of real capital flow and wash trading.'],
      ['Curve Completion', '50 - 85 SOL', 'Rising buying pressure from FOMO as the token nears leaving the virtual curve.'],
      ['Graduation', '~ 85 SOL', 'Migrates 79 SOL + 200M tokens to create a Raydium LP. LP tokens burned & Mint Authority revoked!'],
    ],
  },
  sybil: {
    eyebrow: 'Identity Filtering & Fraud Resistance',
    title: 'Merkle Tree Airdrop & Anti-Sybil Algorithm (LightGBM)',
    intro:
      'This section details how the project fund is protected from airdrop-farming (Sybil) attacks. AIKOL Network combines graph-clustering machine learning (DBSCAN/OPTICS + LightGBM) with Merkle Proofs to ensure 100% of $ZoFo tokens go to real users.',
    checklistTitle: 'Sybil Risk Assessment Criteria Check',
    checklistIntro: 'Tick the behavioral features of a Solana wallet address to simulate the score from the LightGBM algorithm:',
    criteria: [
      { label: 'Same First Gas Funding Source (Funding Source Cluster)', desc: 'Wallets received fee SOL from the same personal wallet / auxiliary CEX address within about 10 minutes.' },
      { label: 'Synchronized Transaction Timing (Temporal Pattern)', desc: 'Buy/sell orders on Pump.fun with a time offset of < 3 seconds.' },
      { label: 'Duplicate WebGL / Canvas Fingerprint', desc: 'Multiple addresses interacting from the same browser hardware/software signature.' },
      { label: 'Has E-Learning / POAP-Scan History (Positive signal)', desc: 'The address has completed a medical test or holds a W3C VC credential.' },
    ],
    scoreLabel: 'Sybil Probability (LightGBM Score):',
    verdictSafe: 'Safe',
    verdictRisk: 'Sybil High Risk Warning',
    statusSafe: '✅ Valid wallet! Issued a Merkle Proof to claim the $ZoFo Airdrop on Viction.',
    statusRisk: '❌ Sybil signals detected! The address is flagged by LightGBM and removed from the Airdrop list.',
    merkleTitle: 'Merkle Tree Verification Architecture (Solidity & OpenZeppelin)',
    merkleIntro:
      'Instead of storing a list of thousands of wallets on the smart contract, which is resource-intensive, the system stores just one 32-byte hash (`Merkle Root`) on the `AirDrop.sol` contract.',
    merkleComment: '// Sample Merkle Proof check in AirDrop.sol',
    bullets: [
      '**Double-Claim Resistance:** Each valid address can claim its reward exactly once, into its ERC-6551 account.',
      '**Privacy Protection:** Integrates Zero-Knowledge Proofs (ZKP) to verify real people without collecting sensitive KYC records.',
    ],
  },
  engine: {
    eyebrow: 'Multi-Layer Competency Attestation',
    title: '5-Layer Attestation Engine (Quint-Engine) & AI MediaPipe',
    intro:
      "The system evaluates a volunteer's credibility and medical competency with the formula: `S_project = Σ (w_i × Score_i), i = 1…5`. Drag the score sliders below to simulate the total credibility score and unlock the Master Hero User title.",
    slidersTitle: '🎛️ Enter Component Scores (0 - 100 points)',
    layers: [
      { name: 'Layer 1: IP Provenance', desc: 'Matches the lecture Perceptual Hash via IPFS/Arweave.' },
      { name: 'Layer 2: E-Learning VC', desc: 'Theory multiple-choice test score (requires ≥ 80%).' },
      { name: 'Layer 3: AI MediaPipe Pose', desc: 'Accuracy of practical movements (33 3D Wasm keypoints).' },
      { name: 'Layer 4: Action / POAP', desc: 'Physical presence (dynamic QR / NFC scan at blood-donation stations).' },
      { name: 'Layer 5: Outcome Impact', desc: 'Output verified by Hospital Oracles (blood-inventory data).' },
    ],
    totalLabel: 'Total Credibility Score (S_project)',
    badges: { master: 'Master Hero User', standard: 'Qualified Volunteer', below: 'Below Minimum Standard' },
    descs: {
      master: '🎉 **Congratulations!** You qualify as a Master Hero User. You may mint Remix versions of lessons and receive 60% of TuneCore Splits revenue.',
      standard: '✅ Qualified as a field volunteer. Eligible for $ZoFo rewards from the L2E and Proof-of-Action funds.',
      below: '⚠️ Total score is below 70. Improve the theory test score or the AI MediaPipe movement exercises.',
    },
    chartTitle: 'Weights & Scores Across the 5 Layers',
    chartDataset: 'Input Score',
  },
  tunecore: {
    eyebrow: 'Self-Sustaining Cash-Flow Model',
    title: 'TuneCore Splits Router Contract & Real-World Impact',
    intro:
      'Unlike purely speculative Web3 projects, AIKOL Network generates real revenue from distributing medical curricula. Use the tool below to calculate how the TuneCore Splits contract automatically allocates cash flow when an original or secondary (Remix) sale occurs.',
    calcTitle: '🧮 Revenue Split Calculator',
    revenueLabel: 'Total Revenue Generated ($):',
    streamLabel: 'Transaction Type:',
    streams: {
      secondary: 'Secondary Remix Sale (Master Hero)',
      primary: 'Primary Sale (Doctor/KOL)',
      microsync: 'Media Rights (Micro-Sync)',
    },
    shares: ['Original Expert / Doctor:', 'Master Hero (Remix Creator):', 'DAO Governance Budget:', 'Oracles & AI Infrastructure Fee:'],
    chartTitle: 'Revenue Split Visualization',
    chartCategory: 'Revenue Split ($)',
    datasets: ['Expert / Doctor', 'Master Hero User', 'DAO Fund', 'Oracles & AI Fee'],
    casesTitle: '🏥 3 Real-World Social Impact Scenarios',
    cases: [
      {
        tag: '1. Relief & Blood Donation',
        title: 'L2E ➔ A2E ➔ I2E Flow',
        desc: 'Volunteers learn theory (L2E), practice bandaging through the AI camera, and scan a POAP on site (A2E). When the hospital Oracle confirms the blood is in stock, the contract automatically disburses DAO funds (I2E).',
      },
      {
        tag: '2. Cancer Care',
        title: 'Revenue Remix Flow',
        desc: "A doctor publishes an original treatment protocol. A patient's family member who reaches Master Hero adds real-life videos and translates it into the local language. When the Remix sells, the family receives 60% to help cover hospital bills and the doctor receives 25% passively.",
      },
      {
        tag: '3. Community Reintegration',
        title: 'ZKP & Discrimination-Resistant Competency Profile',
        desc: 'People with a troubled past learn basic medical skills. Zero-Knowledge Proofs (ZKP) let them prove their professional level to employers without disclosing their criminal record.',
      },
    ],
  },
  mica: {
    eyebrow: 'European Union Legal Framework',
    title: 'MiCA Regulation (Markets in Crypto-Assets - Article 4)',
    intro:
      "An analysis of legality and the strategic exemptions that help AIKOL Network run its cross-chain Airdrop without violating the European Union's (EU) strict regulations.",
    classTitle: '⚖️ Asset Classification Under Article 3(1)(9) MiCA',
    classLabel: 'Classification:',
    classValue: 'Utility Token',
    classText:
      '$ZoFo is neither an ART (Asset-Referenced Token) nor an EMT (E-Money Token), as it is not pegged to fiat assets. Its core purpose is to provide digital access to the E-learning platform and to pay TuneCore royalties.',
    exemptTitle: '📜 3 Whitepaper Publication Exemptions (Article 4)',
    exemptions: [
      '**Offered for Free:** The Airdrop to Solana users requires no payment or collection of personal data.',
      '**Offer Size < EUR 1 Million:** The total value of the public offer in the EU over 12 months does not exceed EUR 1,000,000.',
      '**Already-Operating Platform:** The hienmaunhanvan.com E-learning portal is already live, distinct from ICO models that promise a future.',
    ],
    riskTitle: '⚠️ Critical Legal Risk to Note',
    riskText:
      'The Article 4 MiCA exemptions **lapse immediately** if the issuer announces an intention to seek admission of $ZoFo to trading on an EU-licensed trading platform. This is why AIKOL Network fully separates the roles: the Solana token is a //Community Promo Token//, while the Viction token is a //Utility Token// strictly operating within the European Airdrop exemption framework.',
    legalNote: 'For reference only. This is not legal advice or investment advice.',
  },
  footer: ['© 2026 AIKOL Network (hienmaunhanvan.com). In-Depth Interactive Research Report.', 'Built on Viction Zero-Gas EVM & the Solana Cross-Chain Funnel.'],
}

export function getAikolReportT(language) {
  return language === 'en' ? en : vi
}
