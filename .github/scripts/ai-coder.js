const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

const apiKey = process.env.GEMINI_API_KEY;
const prompt = process.env.ISSUE_BODY;

const genAI = new GoogleGenerativeAI(apiKey);

async function run() {
    const maxRetries = 3; // Thử lại tối đa 3 lần nếu API quá tải
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            // Sử dụng model gemini-3.5-flash theo thiết lập của bạn
            const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
            
            // CẬP NHẬT SYSTEM INSTRUCTION HỖ TRỢ NHIỀU FILE
            const systemInstruction = `Bạn là một AI Developer hỗ trợ viết code cho repo "bao-ve-co-the".
            Người dùng sẽ yêu cầu bạn tạo hoặc sửa MỘT HOẶC NHIỀU file.
            Hãy trả về kết quả theo định dạng sau cho MỖI FILE, ngăn cách giữa các file bằng chuỗi "---END_FILE---":

            FILE_PATH: <đường dẫn file 1>
            CODE:
            <đoạn code của file 1>
            ---END_FILE---
            FILE_PATH: <đường dẫn file 2>
            CODE:
            <đoạn code của file 2>
            ---END_FILE---
            `;

            console.log("Đang gửi yêu cầu tới Gemini API...");
            const result = await model.generateContent(systemInstruction + "\n\nYêu cầu: " + prompt);
            const responseText = result.response.text();

            // LOGIC XỬ LÝ NHIỀU FILE
            const fileBlocks = responseText.split('---END_FILE---');
            let filesProcessed = 0;

            for (const block of fileBlocks) {
                if (!block.trim()) continue; // Bỏ qua các block trống

                const filePathMatch = block.match(/FILE_PATH:\s*(.*)/);
                const codeMatch = block.split(/CODE:\s*\n?/);

                if (filePathMatch && codeMatch.length > 1) {
                    const filePath = filePathMatch[1].trim();
                    
                    // Lấy code và dọn dẹp các ký tự markdown thừa (```javascript, ```html, v.v.)
                    let codeContent = codeMatch[1].trim();
                    codeContent = codeContent.replace(/^```[a-zA-Z0-9]*\n/i, '').replace(/\n```$/i, '');

                    const fullPath = path.join(__dirname, '../../', filePath);
                    
                    // Tạo thư mục nếu chưa tồn tại và ghi file
                    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                    fs.writeFileSync(fullPath, codeContent, 'utf8');
                    
                    console.log(`✅ Đã tạo/cập nhật file thành công tại: ${filePath}`);
                    filesProcessed++;
                }
            }

            if (filesProcessed > 0) {
                console.log(`Hoàn tất! Đã xử lý ${filesProcessed} file.`);
                return; // Thành công thì thoát vòng lặp
            } else {
                throw new Error("AI không trả về đúng format mong đợi.");
            }

        } catch (error) {
            console.error(`❌ Lỗi lần thử thứ ${attempt + 1}:`, error.message);
            attempt++;
            if (attempt >= maxRetries) {
                console.error("Đã thử lại nhiều lần nhưng vẫn thất bại. Dừng chương trình.");
                process.exit(1);
            }
            console.log("Đợi 5 giây rồi thử lại...");
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

run();