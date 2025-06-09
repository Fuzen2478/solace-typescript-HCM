import ldap from 'ldapjs';
import winston from 'winston';

// Logger for Mock LDAP Server
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [MOCK-LDAP] [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'mock-ldap.log' })
  ]
});

// Create LDAP server
const server = ldap.createServer();

// Mock user data for testing
const mockUsers = [
  {
    dn: 'uid=john.doe,ou=people,dc=company,dc=com',
    attributes: {
      uid: 'john.doe',
      cn: 'John Doe',
      sn: 'Doe',
      givenName: 'John',
      mail: 'john.doe@company.com',
      department: 'Engineering',
      title: 'Senior Developer',
      l: 'Seoul',
      telephoneNumber: '+82-10-1234-5678',
      manager: 'uid=jane.smith,ou=people,dc=company,dc=com',
      description: 'Skills: Node.js, TypeScript, React, PostgreSQL, Docker, Kubernetes',
      objectclass: ['person', 'organizationalPerson', 'inetOrgPerson']
    }
  },
  {
    dn: 'uid=jane.smith,ou=people,dc=company,dc=com',
    attributes: {
      uid: 'jane.smith',
      cn: 'Jane Smith',
      sn: 'Smith',
      givenName: 'Jane',
      mail: 'jane.smith@company.com',
      department: 'Engineering',
      title: 'Engineering Manager',
      l: 'Seoul',
      telephoneNumber: '+82-10-2345-6789',
      description: 'Skills: Leadership, Architecture, Java, Python, AWS, Team Management',
      objectclass: ['person', 'organizationalPerson', 'inetOrgPerson']
    }
  },
  {
    dn: 'uid=bob.wilson,ou=people,dc=company,dc=com',
    attributes: {
      uid: 'bob.wilson',
      cn: 'Bob Wilson',
      sn: 'Wilson',
      givenName: 'Bob',
      mail: 'bob.wilson@company.com',
      department: 'Product',
      title: 'Product Manager',
      l: 'Busan',
      telephoneNumber: '+82-10-3456-7890',
      manager: 'uid=jane.smith,ou=people,dc=company,dc=com',
      description: 'Skills: Product Strategy, Analytics, SQL, Figma, User Research',
      objectclass: ['person', 'organizationalPerson', 'inetOrgPerson']
    }
  },
  {
    dn: 'uid=alice.chen,ou=people,dc=company,dc=com',
    attributes: {
      uid: 'alice.chen',
      cn: 'Alice Chen',
      sn: 'Chen',
      givenName: 'Alice',
      mail: 'alice.chen@company.com',
      department: 'Design',
      title: 'UX Designer',
      l: 'Seoul',
      telephoneNumber: '+82-10-4567-8901',
      manager: 'uid=jane.smith,ou=people,dc=company,dc=com',
      description: 'Skills: UI/UX Design, Figma, Adobe Creative Suite, Prototyping, User Testing',
      objectclass: ['person', 'organizationalPerson', 'inetOrgPerson']
    }
  },
  {
    dn: 'uid=mike.johnson,ou=people,dc=company,dc=com',
    attributes: {
      uid: 'mike.johnson',
      cn: 'Mike Johnson',
      sn: 'Johnson',
      givenName: 'Mike',
      mail: 'mike.johnson@company.com',
      department: 'Engineering',
      title: 'DevOps Engineer',
      l: 'Seoul',
      telephoneNumber: '+82-10-5678-9012',
      manager: 'uid=jane.smith,ou=people,dc=company,dc=com',
      description: 'Skills: Docker, Kubernetes, AWS, Terraform, Jenkins, Monitoring',
      objectclass: ['person', 'organizationalPerson', 'inetOrgPerson']
    }
  },
  {
    dn: 'uid=sarah.lee,ou=people,dc=company,dc=com',
    attributes: {
      uid: 'sarah.lee',
      cn: 'Sarah Lee',
      sn: 'Lee',
      givenName: 'Sarah',
      mail: 'sarah.lee@company.com',
      department: 'Marketing',
      title: 'Marketing Manager',
      l: 'Seoul',
      telephoneNumber: '+82-10-6789-0123',
      description: 'Skills: Digital Marketing, SEO, Analytics, Content Strategy, Social Media',
      objectclass: ['person', 'organizationalPerson', 'inetOrgPerson']
    }
  }
];

// Mock organizational units
const mockOrganization = [
  {
    dn: 'ou=people,dc=company,dc=com',
    attributes: {
      objectclass: ['organizationalUnit'],
      ou: 'people',
      description: 'All company personnel'
    }
  },
  {
    dn: 'ou=groups,dc=company,dc=com',
    attributes: {
      objectclass: ['organizationalUnit'],
      ou: 'groups',
      description: 'Organizational groups'
    }
  },
  {
    dn: 'cn=Engineering,ou=groups,dc=company,dc=com',
    attributes: {
      objectclass: ['groupOfNames'],
      cn: 'Engineering',
      description: 'Engineering Department',
      member: [
        'uid=john.doe,ou=people,dc=company,dc=com',
        'uid=jane.smith,ou=people,dc=company,dc=com',
        'uid=mike.johnson,ou=people,dc=company,dc=com'
      ]
    }
  },
  {
    dn: 'cn=Product,ou=groups,dc=company,dc=com',
    attributes: {
      objectclass: ['groupOfNames'],
      cn: 'Product',
      description: 'Product Department',
      member: [
        'uid=bob.wilson,ou=people,dc=company,dc=com'
      ]
    }
  }
];

// Admin bind authentication
server.bind('cn=admin,dc=company,dc=com', (req, res, next) => {
  if (req.credentials === 'password') {
    logger.info('✅ Admin bind successful');
    res.end();
    return next();
  } else {
    logger.warn('❌ Admin bind failed - invalid credentials');
    return next(new ldap.InvalidCredentialsError());
  }
});

// User bind authentication (for login)
server.bind('uid=*,ou=people,dc=company,dc=com', (req, res, next) => {
  const userId = req.dn.rdns[0].attrs.uid.value;
  const user = mockUsers.find(u => u.attributes.uid === userId);
  
  if (user && req.credentials === 'password123') {
    logger.info(`✅ User bind successful: ${userId} (${user.attributes.cn})`);
    res.end();
    return next();
  } else {
    logger.warn(`❌ User bind failed: ${userId}`);
    return next(new ldap.InvalidCredentialsError());
  }
});

// Search for users
server.search('ou=people,dc=company,dc=com', (req, res, next) => {
  const filter = req.filter.toString();
  logger.info(`🔍 Search request: ${filter}`);
  
  let matchCount = 0;
  
  mockUsers.forEach(user => {
    if (req.filter.matches(user.attributes)) {
      res.send({
        dn: user.dn,
        attributes: user.attributes
      });
      matchCount++;
    }
  });
  
  logger.info(`📋 Search completed: ${matchCount} users found`);
  res.end();
});

// Search for organizational units and groups
server.search('ou=groups,dc=company,dc=com', (req, res, next) => {
  const filter = req.filter.toString();
  logger.info(`🔍 Organization search: ${filter}`);
  
  let matchCount = 0;
  
  mockOrganization.forEach(org => {
    if (req.filter.matches(org.attributes)) {
      res.send({
        dn: org.dn,
        attributes: org.attributes
      });
      matchCount++;
    }
  });
  
  logger.info(`🏢 Organization search completed: ${matchCount} entries found`);
  res.end();
});

// Root search (base DN)
server.search('dc=company,dc=com', (req, res, next) => {
  const filter = req.filter.toString();
  const scope = req.scope;
  
  logger.info(`🔍 Root search: ${filter} (scope: ${scope})`);
  
  let matchCount = 0;
  
  // Send root entry for base searches
  if (scope === 'base') {
    res.send({
      dn: 'dc=company,dc=com',
      attributes: {
        objectclass: ['top', 'domain'],
        dc: 'company'
      }
    });
    matchCount++;
  } else {
    // For subtree searches, include all users and organizational units
    [...mockUsers, ...mockOrganization].forEach(entry => {
      if (req.filter.matches(entry.attributes)) {
        res.send({
          dn: entry.dn,
          attributes: entry.attributes
        });
        matchCount++;
      }
    });
  }
  
  logger.info(`📋 Root search completed: ${matchCount} entries found`);
  res.end();
});

// Handle unbind requests
server.unbind((req, res, next) => {
  logger.info('👋 Client disconnected');
  res.end();
  return next();
});

// Error handling
server.on('error', (error) => {
  logger.error('❌ LDAP Server error:', error);
});

// Start the server
const PORT = process.env.LDAP_PORT || 389;

server.listen(PORT, () => {
  logger.info(`🏢 Mock LDAP Server running on port ${PORT}`);
  logger.info('');
  logger.info('📋 Available test users:');
  mockUsers.forEach(user => {
    logger.info(`   - ${user.attributes.cn} (${user.attributes.uid}) - ${user.attributes.department}`);
  });
  logger.info('');
  logger.info('🔑 Authentication credentials:');
  logger.info('   Admin: cn=admin,dc=company,dc=com / password');
  logger.info('   Users: [username] / password123');
  logger.info('');
  logger.info('🔍 Test search commands:');
  logger.info('   ldapsearch -x -H ldap://localhost:389 -D "cn=admin,dc=company,dc=com" -w password -b "ou=people,dc=company,dc=com"');
  logger.info('   ldapsearch -x -H ldap://localhost:389 -D "cn=admin,dc=company,dc=com" -w password -b "dc=company,dc=com" "(department=Engineering)"');
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('\n🔄 Shutting down Mock LDAP server...');
  server.close(() => {
    logger.info('✅ Mock LDAP server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  logger.info('\n🔄 Received SIGTERM, shutting down Mock LDAP server...');
  server.close(() => {
    logger.info('✅ Mock LDAP server closed');
    process.exit(0);
  });
});

export default server;
