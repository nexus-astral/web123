const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  async sendOTP(email, otp) {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'ExploitX 2025 - Email Verification OTP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #00f0ff, #a855f7); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">ExploitX 2025</h1>
            <p style="color: white; margin: 5px 0;">Into the Void</p>
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333;">Email Verification Required</h2>
            <p style="color: #666; font-size: 16px;">
              Your OTP for ExploitX 2025 registration verification is:
            </p>
            <div style="background: #007BFF; color: white; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; margin: 20px 0; border-radius: 5px;">
              ${otp}
            </div>
            <p style="color: #666; font-size: 14px;">
              This OTP will expire in 10 minutes. Please do not share this code with anyone.
            </p>
            <p style="color: #666; font-size: 14px;">
              If you didn't request this verification, please ignore this email.
            </p>
          </div>
          <div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
            © 2025 ExploitX. All rights reserved.
          </div>
        </div>
      `
    };

    return await this.transporter.sendMail(mailOptions);
  }

  async sendRegistrationConfirmation(teamData) {
    const leaderEmail = teamData.teamLeader === 'player1' 
      ? teamData.player1.email 
      : teamData.player2.email;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: leaderEmail,
      subject: 'ExploitX 2025 - Registration Confirmation',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #00f0ff, #a855f7); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">ExploitX 2025</h1>
            <p style="color: white; margin: 5px 0;">Into the Void</p>
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333;">Registration Successful! 🎉</h2>
            <p style="color: #666; font-size: 16px;">
              Congratulations! Your team has been successfully registered for ExploitX 2025.
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007BFF;">
              <h3 style="color: #333; margin-top: 0;">Team Details</h3>
              <p><strong>Team Name:</strong> ${teamData.teamName}</p>
              <p><strong>Team Leader:</strong> ${teamData.teamLeader === 'player1' ? teamData.player1.username : teamData.player2.username}</p>
              <p><strong>Registration Fee:</strong> ${teamData.isFree ? 'FREE' : '$' + teamData.registrationFee}</p>
              <p><strong>Payment Status:</strong> ${teamData.paymentStatus.toUpperCase()}</p>
            </div>

            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #333; margin-top: 0;">Player 1</h3>
              <p><strong>Username:</strong> ${teamData.player1.username}</p>
              <p><strong>Email:</strong> ${teamData.player1.email}</p>
              <p><strong>College:</strong> ${teamData.player1.collegeName}</p>
            </div>

            ${teamData.player2 ? `
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #333; margin-top: 0;">Player 2</h3>
              <p><strong>Username:</strong> ${teamData.player2.username}</p>
              <p><strong>Email:</strong> ${teamData.player2.email}</p>
              <p><strong>College:</strong> ${teamData.player2.collegeName}</p>
            </div>
            ` : ''}

            <div style="background: #e8f4fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h4 style="color: #0066cc; margin-top: 0;">Next Steps:</h4>
              <ul style="color: #666;">
                <li>Join our Discord community: ExploitX2025</li>
                <li>Competition starts: June 23, 2025 at 12:00 PM</li>
                <li>Check your email for further updates</li>
                ${!teamData.isFree ? '<li>Complete payment to confirm your registration</li>' : ''}
              </ul>
            </div>

            <p style="color: #666; font-size: 14px;">
              If you have any questions, feel free to contact us at info@exploitx.com
            </p>
          </div>
          <div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
            © 2025 ExploitX. All rights reserved.
          </div>
        </div>
      `
    };

    return await this.transporter.sendMail(mailOptions);
  }
}

module.exports = new EmailService();